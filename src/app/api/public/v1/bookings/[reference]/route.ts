import type { NextRequest } from "next/server";
import { guardApi, json } from "@/server/api/http";
import { getReservationByReference } from "@/server/reservations/service";
import { bookingSummary } from "../summary";

// GET /api/public/v1/bookings/{reference} — confirmation page summary. A site only sees its own bookings.
export async function GET(req: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const client = await guardApi(req);
  if (client instanceof Response) return client;
  const { reference } = await params;
  const reservation = await getReservationByReference(decodeURIComponent(reference).slice(0, 30), client.id);
  if (!reservation) return json(404, { error: "not_found", message: "No booking with this reference." });
  return json(200, bookingSummary(reservation));
}
