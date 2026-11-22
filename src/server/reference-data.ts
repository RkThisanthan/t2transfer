import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db/client";
import { locationTypes, locations, phoneCountryCodes } from "@/server/db/schema";

export type LocationOption = { id: number; name: string; typeName: string };
export type LocationGroup = { typeName: string; locations: { id: number; name: string }[] };

export const getActiveLocations = cache(async (): Promise<LocationOption[]> => {
  return db
    .select({ id: locations.id, name: locations.name, typeName: locationTypes.name })
    .from(locations)
    .innerJoin(locationTypes, eq(locationTypes.id, locations.locationTypeId))
    .where(eq(locations.isActive, true))
    .orderBy(asc(locationTypes.sortOrder), asc(locations.sortOrder), asc(locations.name));
});

export async function getLocationGroups(): Promise<LocationGroup[]> {
  const groups = new Map<string, LocationGroup>();
  for (const l of await getActiveLocations()) {
    const g = groups.get(l.typeName) ?? { typeName: l.typeName, locations: [] };
    g.locations.push({ id: l.id, name: l.name });
    groups.set(l.typeName, g);
  }
  return [...groups.values()];
}

/** Every location (active or not) by id, for showing names on existing reservations. */
export const getLocationNames = cache(async (): Promise<Map<number, string>> => {
  const rows = await db.select({ id: locations.id, name: locations.name }).from(locations);
  return new Map(rows.map((r) => [r.id, r.name]));
});

export const getPhoneCodes = cache(async () => {
  // The legacy list repeats some country/code pairs; keep one of each.
  return db
    .selectDistinct({ country: phoneCountryCodes.country, code: phoneCountryCodes.code })
    .from(phoneCountryCodes)
    .orderBy(asc(phoneCountryCodes.country), asc(phoneCountryCodes.code));
});
