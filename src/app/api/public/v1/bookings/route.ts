import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { clientIp, guardApi, json } from "@/server/api/http";
import { db } from "@/server/db/client";
import { idempotencyKeys } from "@/server/db/schema";
import { publicBookingSchema } from "@/server/reservations/input";
import { createPublicBooking, getReservation } from "@/server/reservations/service";
import { bookingSummary } from "./summary";

const IDEMPOTENCY_RE = /^[A-Za-z0-9_\-:.]{8,100}$/;

function validationErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string[]> = {};
  for (const i of issues) (errors[i.path.map(String).join(".") || "_"] ??= []).push(i.message);
  return errors;
}

// POST /api/public/v1/bookings — create a booking from a WordPress site (spec Section 6.1, P1-RES-01/02/12).
export async function POST(req: NextRequest) {
  const client = await guardApi(req);
  if (client instanceof Response) return client;

  const idemKey = req.headers.get("idempotency-key");
  if (!idemKey || !IDEMPOTENCY_RE.test(idemKey)) {
    return json(400, { error: "idempotency_key_required", message: "Send an Idempotency-Key header (8–100 characters, e.g. a UUID)." });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json", message: "The request body must be JSON." });
  }

  const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const keyWhere = and(eq(idempotencyKeys.apiClientId, client.id), eq(idempotencyKeys.key, idemKey));

  // A key that was already used: replay the first answer, or refuse if the body is different.
  const replay = async () => {
    const [prev] = await db.select().from(idempotencyKeys).where(keyWhere).limit(1);
    if (!prev) return null;
    if (prev.requestHash !== requestHash) {
      return json(409, { error: "idempotency_conflict", message: "This Idempotency-Key was already used with a different request." });
    }
    if (prev.responseStatus === 0) return json(409, { error: "in_progress", message: "The same request is still being processed." });
    return json(prev.responseStatus, prev.responseBody, { "Idempotent-Replayed": "true" });
  };
  const earlier = await replay();
  if (earlier) return earlier;

  const parsed = publicBookingSchema.safeParse(body);
  if (!parsed.success) return json(422, { error: "validation_failed", errors: validationErrors(parsed.error.issues) });

  // Reserve the key before creating, so two identical requests at the same time cannot both create a booking.
  try {
    await db.insert(idempotencyKeys).values({ apiClientId: client.id, key: idemKey, requestHash, responseStatus: 0, responseBody: {} });
  } catch (err) {
    const code = (err as { cause?: { code?: string }; code?: string }).cause?.code ?? (err as { code?: string }).code;
    if (code !== "ER_DUP_ENTRY") throw err;
    return (await replay()) ?? json(409, { error: "in_progress", message: "The same request is still being processed." });
  }

  try {
    const { id } = await createPublicBooking(parsed.data, client.site, {
      userId: null,
      apiClientId: client.id,
      meta: { ip: clientIp(req), userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null },
    });
    const reservation = await getReservation(id);
    const responseBody = bookingSummary(reservation!);
    await db.update(idempotencyKeys).set({ responseStatus: 201, responseBody }).where(keyWhere);
    return json(201, responseBody);
  } catch (err) {
    await db.delete(idempotencyKeys).where(keyWhere);
    console.error("Booking API create failed", err);
    return json(500, { error: "server_error", message: "The booking could not be saved. Please try again." });
  }
}
