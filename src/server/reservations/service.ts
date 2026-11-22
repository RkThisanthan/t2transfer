import { and, count, desc, eq, gte, inArray, isNotNull, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  LEG_KINDS,
  referenceCounters,
  reservationLegs,
  reservations,
  type Reservation,
  type ReservationLeg,
} from "@/server/db/schema";
import { diff, writeAudit, type Actor } from "@/server/audit";
import { LEGS_FOR_TRIP, type AdminReservationInput, type PublicBookingInput } from "./input";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type LegKind = (typeof LEG_KINDS)[number];
export type ReservationWithLegs = Reservation & { legs: ReservationLeg[] };

// ---------------------------------------------------------------------------
// Reference numbers: T2-YYMMDD-NNNN (Paris date). Format still to confirm with the client.

function parisDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}${get("month")}${get("day")}`;
}

async function nextReference(tx: Tx): Promise<string> {
  const day = parisDay();
  // LAST_INSERT_ID(expr) makes the increment and the read atomic on this connection.
  await tx
    .insert(referenceCounters)
    .values({ day, lastValue: sql`LAST_INSERT_ID(1)` })
    .onDuplicateKeyUpdate({ set: { lastValue: sql`LAST_INSERT_ID(${referenceCounters.lastValue} + 1)` } });
  const [[row]] = (await tx.execute(sql`SELECT LAST_INSERT_ID() AS n`)) as unknown as [[{ n: number }]];
  return `T2-${day}-${String(row.n).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Money: total = leg rates + night charges + upgrade − discount (never below 0).

type LegValues = Omit<typeof reservationLegs.$inferInsert, "reservationId" | "id">;

function legRows(input: { tripType: AdminReservationInput["tripType"] } & Partial<Record<LegKind, Partial<LegValues> | undefined>>): LegValues[] {
  return LEGS_FOR_TRIP[input.tripType].map((kind) => {
    const leg = input[kind] ?? {};
    return {
      kind,
      pickupLocationId: leg.pickupLocationId ?? null,
      pickupAddress: leg.pickupAddress ?? null,
      dropLocationId: leg.dropLocationId ?? null,
      dropAddress: leg.dropAddress ?? null,
      pickupAt: leg.pickupAt ?? null,
      flightNo: leg.flightNo ?? null,
      flightCity: leg.flightCity ?? null,
      flightAt: leg.flightAt ?? null,
      rate: leg.rate ?? 0,
      nightCharge: leg.nightCharge ?? 0,
      vatRate: leg.vatRate ?? 0,
    };
  });
}

function computeTotal(legs: LegValues[], upgradeCost: number, discount: number): number {
  const sum = legs.reduce((s, l) => s + Number(l.rate ?? 0) + Number(l.nightCharge ?? 0), 0) + upgradeCost - discount;
  return Math.max(0, Math.round(sum * 100) / 100);
}

function reservationColumns(input: AdminReservationInput) {
  return {
    site: input.site,
    tripType: input.tripType,
    status: input.status,
    title: input.title,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phoneCode: input.phoneCode,
    phone: input.phone,
    adults: input.adults,
    children: input.children,
    babies: input.babies,
    luggageSmall: input.luggageSmall,
    luggageLarge: input.luggageLarge,
    luggageXl: input.luggageXl,
    trolleys: input.trolleys,
    vehicleClass: input.vehicleClass,
    upgradeCost: input.upgradeCost,
    voucherCode: input.voucherCode,
    discount: input.discount,
    paymentMethod: input.paymentMethod ?? null,
    paymentStatus: input.paymentStatus,
    clientComments: input.clientComments,
    specialNotes: input.specialNotes,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
  };
}

const legAuditShape = (legs: LegValues[]) => Object.fromEntries(legs.map((l) => [`leg.${l.kind}`, { ...l }]));

// ---------------------------------------------------------------------------
// Create

export async function createReservation(input: AdminReservationInput, actor: Actor): Promise<{ id: number; reference: string }> {
  return db.transaction(async (tx) => {
    const legs = legRows(input);
    const reference = await nextReference(tx);
    const values = {
      ...reservationColumns(input),
      reference,
      source: actor.apiClientId ? ("api" as const) : ("admin" as const),
      total: computeTotal(legs, input.upgradeCost, input.discount),
      apiClientId: actor.apiClientId,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    };
    const [res] = await tx.insert(reservations).values(values);
    const id = res.insertId;
    await tx.insert(reservationLegs).values(legs.map((l) => ({ ...l, reservationId: id })));
    await writeAudit(tx, actor, { action: "create", type: "reservation", id, new: { ...values, ...legAuditShape(legs) } });
    return { id, reference };
  });
}

/** Booking API: same as create, but status/prices/payment are set by the server, not the caller. */
export function createPublicBooking(input: PublicBookingInput, site: Reservation["site"], actor: Actor) {
  // TODO(P1-RAT-05, P1-VCH-05): price legs from the rates table and apply the voucher once those modules exist.
  const unpriced = { rate: 0, nightCharge: 0, vatRate: 0 };
  const withPrice = <T extends object>(leg: T | undefined) => (leg ? { ...leg, ...unpriced } : undefined);
  return createReservation(
    {
      ...input,
      arrival: withPrice(input.arrival),
      departure: withPrice(input.departure),
      single: withPrice(input.single),
      site,
      status: "pending",
      upgradeCost: 0,
      discount: 0,
      paymentMethod: null,
      paymentStatus: "unpaid",
      specialNotes: null,
    },
    actor,
  );
}

// ---------------------------------------------------------------------------
// Read

export async function getReservation(id: number, opts: { includeDeleted?: boolean } = {}): Promise<ReservationWithLegs | null> {
  const [row] = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, id), opts.includeDeleted ? undefined : isNull(reservations.deletedAt)))
    .limit(1);
  if (!row) return null;
  const legs = await db.select().from(reservationLegs).where(eq(reservationLegs.reservationId, id));
  return { ...row, legs: sortLegs(legs) };
}

export async function getReservationByReference(reference: string, apiClientId: number) {
  const [row] = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.reference, reference), eq(reservations.apiClientId, apiClientId), isNull(reservations.deletedAt)))
    .limit(1);
  return row ? getReservation(row.id) : null;
}

const sortLegs = (legs: ReservationLeg[]) => legs.sort((a, b) => LEG_KINDS.indexOf(a.kind) - LEG_KINDS.indexOf(b.kind));

export type ReservationFilters = {
  q?: string;
  reference?: string;
  pickupDate?: string; // YYYY-MM-DD, matches any leg's pickup or flight date (Paris time)
  createdDate?: string; // YYYY-MM-DD, Paris day
  status?: Reservation["status"];
  site?: Reservation["site"];
  tripType?: Reservation["tripType"];
  deleted?: boolean;
  page?: number;
};

export const PAGE_SIZE = 20;

/** UTC range covering one Paris calendar day (created_at is stored in UTC). */
function parisDayUtcRange(day: string): [Date, Date] {
  const offsetAt = (d: Date) => {
    const tz = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")!.value;
    const m = tz.match(/GMT([+-])(\d{2}):(\d{2})/);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  };
  const noonUtc = new Date(`${day}T12:00:00Z`);
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() - offsetAt(noonUtc) * 60000);
  return [start, new Date(start.getTime() + 24 * 60 * 60 * 1000)];
}

export async function listReservations(filters: ReservationFilters) {
  const where: SQL[] = [filters.deleted ? isNotNull(reservations.deletedAt) : isNull(reservations.deletedAt)];

  if (filters.reference) where.push(like(reservations.reference, `%${filters.reference.trim()}%`));
  if (filters.q) {
    const q = `%${filters.q.trim()}%`;
    where.push(or(like(reservations.reference, q), like(reservations.firstName, q), like(reservations.lastName, q), like(reservations.email, q), like(reservations.phone, q))!);
  }
  if (filters.status) where.push(eq(reservations.status, filters.status));
  if (filters.site) where.push(eq(reservations.site, filters.site));
  if (filters.tripType) where.push(eq(reservations.tripType, filters.tripType));
  if (filters.createdDate) {
    const [from, to] = parisDayUtcRange(filters.createdDate);
    where.push(gte(reservations.createdAt, from), lt(reservations.createdAt, to));
  }
  if (filters.pickupDate) {
    const from = `${filters.pickupDate} 00:00:00`;
    const to = `${filters.pickupDate} 23:59:59`;
    const legMatch = db
      .select({ id: reservationLegs.reservationId })
      .from(reservationLegs)
      .where(
        or(
          and(gte(reservationLegs.pickupAt, from), lt(reservationLegs.pickupAt, to)),
          and(gte(reservationLegs.flightAt, from), lt(reservationLegs.flightAt, to)),
        ),
      );
    where.push(inArray(reservations.id, legMatch));
  }

  const condition = and(...where);
  const [{ total }] = await db.select({ total: count() }).from(reservations).where(condition);
  const page = Math.min(Math.max(1, filters.page ?? 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await db
    .select()
    .from(reservations)
    .where(condition)
    .orderBy(desc(reservations.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const legs = rows.length
    ? await db.select().from(reservationLegs).where(inArray(reservationLegs.reservationId, rows.map((r) => r.id)))
    : [];
  const items: ReservationWithLegs[] = rows.map((r) => ({ ...r, legs: sortLegs(legs.filter((l) => l.reservationId === r.id)) }));

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ---------------------------------------------------------------------------
// Update, delete, restore

export async function updateReservation(id: number, input: AdminReservationInput, actor: Actor): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(reservations).where(and(eq(reservations.id, id), isNull(reservations.deletedAt))).limit(1);
    if (!before) return false;
    const beforeLegs = await tx.select().from(reservationLegs).where(eq(reservationLegs.reservationId, id));

    const legs = legRows(input);
    const values = { ...reservationColumns(input), total: computeTotal(legs, input.upgradeCost, input.discount), updatedBy: actor.userId };
    await tx.update(reservations).set(values).where(eq(reservations.id, id));
    await tx.delete(reservationLegs).where(eq(reservationLegs.reservationId, id));
    await tx.insert(reservationLegs).values(legs.map((l) => ({ ...l, reservationId: id })));

    const oldLegs = legAuditShape(beforeLegs.map(({ id: _id, reservationId: _r, ...l }) => l));
    const changes = diff({ ...before, ...oldLegs }, { ...values, ...legAuditShape(legs) });
    delete changes.old.updatedBy;
    delete changes.new.updatedBy;
    if (Object.keys(changes.new).length) {
      await writeAudit(tx, actor, { action: "update", type: "reservation", id, old: changes.old, new: changes.new });
    }
    return true;
  });
}

export async function softDeleteReservation(id: number, actor: Actor): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [res] = await tx
      .update(reservations)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(and(eq(reservations.id, id), isNull(reservations.deletedAt)));
    if (!res.affectedRows) return false;
    await writeAudit(tx, actor, { action: "delete", type: "reservation", id });
    return true;
  });
}

export async function restoreReservation(id: number, actor: Actor): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [res] = await tx
      .update(reservations)
      .set({ deletedAt: null, updatedBy: actor.userId })
      .where(and(eq(reservations.id, id), isNotNull(reservations.deletedAt)));
    if (!res.affectedRows) return false;
    await writeAudit(tx, actor, { action: "restore", type: "reservation", id });
    return true;
  });
}
