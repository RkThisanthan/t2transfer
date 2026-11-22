import { inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";

/** Display names for a set of user ids (e.g. "created by" / "updated by"). */
export async function getUserNames(ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id): id is number => typeof id === "number"))];
  if (!unique.length) return new Map();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((u) => [u.id, u.name]));
}
