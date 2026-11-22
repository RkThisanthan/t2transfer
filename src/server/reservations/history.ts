import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { apiClients, auditLogs, users } from "@/server/db/schema";

/** Audit trail of one reservation, newest first (shown on the reservation page, P1-RES-07). */
// MariaDB stores JSON columns as LONGTEXT, so the driver can hand them back as strings.
const parseJson = (v: unknown): Record<string, unknown> | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v as Record<string, unknown>;
};

export async function getReservationHistory(id: number) {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      userName: users.name,
      apiClientName: apiClients.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .leftJoin(apiClients, eq(apiClients.id, auditLogs.apiClientId))
    .where(and(eq(auditLogs.auditableType, "reservation"), eq(auditLogs.auditableId, String(id))))
    .orderBy(desc(auditLogs.id))
    .limit(50);
  return rows.map((r) => ({ ...r, oldValues: parseJson(r.oldValues), newValues: parseJson(r.newValues) }));
}
