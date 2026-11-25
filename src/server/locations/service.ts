// Locations and location types (spec P1-LOC-01 / P1-LOC-02).
// Rule: a location or type that is in use cannot be deleted — locations are deactivated instead.
import { and, asc, count, eq, like, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { locationTypes, locations, reservationLegs } from "@/server/db/schema";
import { diff, writeAudit, type Actor } from "@/server/audit";

// ---------------------------------------------------------------------------
// Validation

const sortOrder = z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(0, "Cannot be negative").max(100000);

export const locationInput = z.object({
  name: z.string({ error: "Enter a name" }).trim().min(2, "Enter a name (at least 2 characters)").max(190),
  locationTypeId: z.coerce.number({ error: "Choose a type" }).int().positive("Choose a type"),
  sortOrder: sortOrder.default(10000),
});
export type LocationInput = z.infer<typeof locationInput>;

export const locationTypeInput = z.object({
  name: z.string({ error: "Enter a name" }).trim().min(2, "Enter a name (at least 2 characters)").max(80),
  sortOrder: sortOrder.default(100),
});
export type LocationTypeInput = z.infer<typeof locationTypeInput>;

export class LocationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Usage: how many reservation transfers point at a location (pickup or drop)

async function usageByLocation(): Promise<Map<number, number>> {
  const rows = await db.execute(sql`
    SELECT location_id AS id, COUNT(*) AS n FROM (
      SELECT pickup_location_id AS location_id FROM reservation_legs WHERE pickup_location_id IS NOT NULL
      UNION ALL
      SELECT drop_location_id FROM reservation_legs WHERE drop_location_id IS NOT NULL
    ) t GROUP BY location_id`);
  const list = (rows as unknown as [Array<{ id: number; n: number }>])[0];
  return new Map(list.map((r) => [Number(r.id), Number(r.n)]));
}

export async function locationUsage(id: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(reservationLegs)
    .where(or(eq(reservationLegs.pickupLocationId, id), eq(reservationLegs.dropLocationId, id)));
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Read

export type LocationRow = {
  id: number;
  name: string;
  locationTypeId: number;
  typeName: string;
  sortOrder: number;
  isActive: boolean;
  legacyId: number | null;
  usage: number;
};

export type LocationFilters = { q?: string; typeId?: number; status?: "active" | "inactive" };

export async function listLocations(filters: LocationFilters = {}): Promise<LocationRow[]> {
  const where = [];
  if (filters.q) where.push(like(locations.name, `%${filters.q.trim()}%`));
  if (filters.typeId) where.push(eq(locations.locationTypeId, filters.typeId));
  if (filters.status) where.push(eq(locations.isActive, filters.status === "active"));

  const [rows, usage] = await Promise.all([
    db
      .select({
        id: locations.id,
        name: locations.name,
        locationTypeId: locations.locationTypeId,
        typeName: locationTypes.name,
        sortOrder: locations.sortOrder,
        isActive: locations.isActive,
        legacyId: locations.legacyId,
      })
      .from(locations)
      .innerJoin(locationTypes, eq(locationTypes.id, locations.locationTypeId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(locationTypes.sortOrder), asc(locationTypes.name), asc(locations.sortOrder), asc(locations.name)),
    usageByLocation(),
  ]);
  return rows.map((r) => ({ ...r, usage: usage.get(r.id) ?? 0 }));
}

export async function getLocation(id: number) {
  const [row] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  return row ?? null;
}

export type LocationTypeRow = { id: number; name: string; sortOrder: number; locationCount: number };

export async function listLocationTypes(): Promise<LocationTypeRow[]> {
  const [types, counts] = await Promise.all([
    db
      .select({ id: locationTypes.id, name: locationTypes.name, sortOrder: locationTypes.sortOrder })
      .from(locationTypes)
      .orderBy(asc(locationTypes.sortOrder), asc(locationTypes.name)),
    db.select({ typeId: locations.locationTypeId, n: count() }).from(locations).groupBy(locations.locationTypeId),
  ]);
  const byType = new Map(counts.map((c) => [c.typeId, c.n]));
  return types.map((t) => ({ ...t, locationCount: byType.get(t.id) ?? 0 }));
}

export async function getLocationType(id: number) {
  const [row] = await db.select().from(locationTypes).where(eq(locationTypes.id, id)).limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Locations: create, update, activate/deactivate, delete

async function assertUniqueName(name: string, typeId: number, exceptId?: number) {
  const [dup] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.locationTypeId, typeId), sql`LOWER(${locations.name}) = ${name.toLowerCase()}`, exceptId ? ne(locations.id, exceptId) : undefined))
    .limit(1);
  if (dup) throw new LocationError("name", "A location with this name already exists in this type.");
}

async function assertTypeExists(typeId: number) {
  if (!(await getLocationType(typeId))) throw new LocationError("locationTypeId", "Choose a type");
}

export async function createLocation(input: LocationInput, actor: Actor): Promise<number> {
  await assertTypeExists(input.locationTypeId);
  await assertUniqueName(input.name, input.locationTypeId);
  const values = { ...input, isActive: true }; // new locations are always active
  return db.transaction(async (tx) => {
    const [res] = await tx.insert(locations).values(values);
    await writeAudit(tx, actor, { action: "create", type: "location", id: res.insertId, new: values });
    return res.insertId;
  });
}

export async function updateLocation(id: number, input: LocationInput, actor: Actor): Promise<boolean> {
  const before = await getLocation(id);
  if (!before) return false;
  await assertTypeExists(input.locationTypeId);
  await assertUniqueName(input.name, input.locationTypeId, id);
  await db.transaction(async (tx) => {
    await tx.update(locations).set(input).where(eq(locations.id, id));
    const changes = diff(before, input);
    if (Object.keys(changes.new).length) await writeAudit(tx, actor, { action: "update", type: "location", id, old: changes.old, new: changes.new });
  });
  return true;
}

export async function setLocationActive(id: number, isActive: boolean, actor: Actor): Promise<boolean> {
  const before = await getLocation(id);
  if (!before || before.isActive === isActive) return Boolean(before);
  await db.transaction(async (tx) => {
    await tx.update(locations).set({ isActive }).where(eq(locations.id, id));
    await writeAudit(tx, actor, { action: "update", type: "location", id, old: { isActive: before.isActive }, new: { isActive } });
  });
  return true;
}

/** Only for unused locations; anything used by a reservation must be deactivated instead. */
export async function deleteLocation(id: number, actor: Actor): Promise<void> {
  const before = await getLocation(id);
  if (!before) return;
  const used = await locationUsage(id);
  if (used > 0) throw new LocationError("_", `This location is used by ${used} transfer(s). Deactivate it instead.`);
  await db.transaction(async (tx) => {
    await tx.delete(locations).where(eq(locations.id, id));
    await writeAudit(tx, actor, { action: "delete", type: "location", id, old: { ...before } });
  });
}

// ---------------------------------------------------------------------------
// Location types: create, update, delete

async function assertUniqueTypeName(name: string, exceptId?: number) {
  const [dup] = await db
    .select({ id: locationTypes.id })
    .from(locationTypes)
    .where(and(sql`LOWER(${locationTypes.name}) = ${name.toLowerCase()}`, exceptId ? ne(locationTypes.id, exceptId) : undefined))
    .limit(1);
  if (dup) throw new LocationError("name", "A type with this name already exists.");
}

export async function createLocationType(input: LocationTypeInput, actor: Actor): Promise<number> {
  await assertUniqueTypeName(input.name);
  return db.transaction(async (tx) => {
    const [res] = await tx.insert(locationTypes).values(input);
    await writeAudit(tx, actor, { action: "create", type: "location_type", id: res.insertId, new: { ...input } });
    return res.insertId;
  });
}

export async function updateLocationType(id: number, input: LocationTypeInput, actor: Actor): Promise<boolean> {
  const before = await getLocationType(id);
  if (!before) return false;
  await assertUniqueTypeName(input.name, id);
  await db.transaction(async (tx) => {
    await tx.update(locationTypes).set(input).where(eq(locationTypes.id, id));
    const changes = diff(before, input);
    if (Object.keys(changes.new).length) await writeAudit(tx, actor, { action: "update", type: "location_type", id, old: changes.old, new: changes.new });
  });
  return true;
}

/** Only for empty types: move or delete its locations first. */
export async function deleteLocationType(id: number, actor: Actor): Promise<void> {
  const before = await getLocationType(id);
  if (!before) return;
  const [{ n }] = await db.select({ n: count() }).from(locations).where(eq(locations.locationTypeId, id));
  if (n > 0) throw new LocationError("_", `This type still has ${n} location(s). Move or delete them first.`);
  await db.transaction(async (tx) => {
    await tx.delete(locationTypes).where(eq(locationTypes.id, id));
    await writeAudit(tx, actor, { action: "delete", type: "location_type", id, old: { ...before } });
  });
}
