import { db } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";
import type { RequestMeta } from "@/server/auth/request-meta";

export type Actor = { userId: number | null; apiClientId: number | null; meta: RequestMeta };
type Executor = Pick<typeof db, "insert">;
type Values = Record<string, unknown>;

const SECRET_FIELDS = new Set(["passwordHash", "keyHash", "password"]);

function clean(values: Values | null): Values | null {
  if (!values) return null;
  return Object.fromEntries(Object.entries(values).filter(([k]) => !SECRET_FIELDS.has(k)));
}

/** Only the fields that changed, so an update entry shows exactly what was edited (P1-AUD-02). */
export function diff(before: Values, after: Values): { old: Values; new: Values } {
  const old: Values = {};
  const next: Values = {};
  for (const key of Object.keys(after)) {
    const a = before[key] instanceof Date ? (before[key] as Date).toISOString() : before[key];
    const b = after[key] instanceof Date ? (after[key] as Date).toISOString() : after[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
      old[key] = a ?? null;
      next[key] = b ?? null;
    }
  }
  return { old, new: next };
}

export async function writeAudit(
  exec: Executor,
  actor: Actor,
  entry: { action: "create" | "update" | "delete" | "restore"; type: string; id: string | number; old?: Values | null; new?: Values | null },
) {
  await exec.insert(auditLogs).values({
    userId: actor.userId,
    apiClientId: actor.apiClientId,
    action: entry.action,
    auditableType: entry.type,
    auditableId: String(entry.id),
    oldValues: clean(entry.old ?? null),
    newValues: clean(entry.new ?? null),
    ip: actor.meta.ip,
    userAgent: actor.meta.userAgent,
  });
}
