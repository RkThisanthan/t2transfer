import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { loginEvents, users } from "@/server/db/schema";
import { IP_WINDOW_MS, LOCK_MS, MAX_FAILED_PER_IP, MAX_FAILED_PER_USER } from "./config";
import { verifyAgainstDummy, verifyPassword } from "./password";
import type { RequestMeta } from "./request-meta";

export type LoginResult =
  | { ok: true; userId: number }
  | { ok: false; reason: "invalid" | "locked" | "disabled" | "ip_blocked" };

type LoginEvent = (typeof loginEvents.$inferInsert)["event"];

export async function recordLoginEvent(event: LoginEvent, meta: RequestMeta, userId: number | null, usernameTried?: string) {
  await db.insert(loginEvents).values({
    event,
    userId,
    usernameTried: usernameTried?.slice(0, 190) ?? null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

async function isIpBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const since = new Date(Date.now() - IP_WINDOW_MS);
  const [row] = await db
    .select({ n: count() })
    .from(loginEvents)
    .where(and(eq(loginEvents.ip, ip), eq(loginEvents.event, "failed"), gt(loginEvents.createdAt, since)));
  return (row?.n ?? 0) >= MAX_FAILED_PER_IP;
}

/**
 * Checks a username-or-email + password (P1-AUTH-01, 05, 07, 08).
 * The caller shows one generic message for "invalid", so it never reveals whether a username exists.
 */
export async function verifyLogin(identifier: string, password: string, meta: RequestMeta): Promise<LoginResult> {
  if (await isIpBlocked(meta.ip)) {
    await recordLoginEvent("blocked_ip", meta, null, identifier);
    return { ok: false, reason: "ip_blocked" };
  }

  const ident = identifier.trim();
  const [user] = await db
    .select()
    .from(users)
    .where(and(or(eq(users.username, ident), eq(users.email, ident.toLowerCase())), isNull(users.deletedAt)))
    .limit(1);

  if (!user) {
    await verifyAgainstDummy(password);
    await recordLoginEvent("failed", meta, null, ident);
    return { ok: false, reason: "invalid" };
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    await recordLoginEvent("locked", meta, user.id, ident);
    return { ok: false, reason: "locked" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_PER_USER;
    await db
      .update(users)
      .set({ failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : user.lockedUntil })
      .where(eq(users.id, user.id));
    await recordLoginEvent(lock ? "locked" : "failed", meta, user.id, ident);
    return { ok: false, reason: lock ? "locked" : "invalid" };
  }

  if (user.status !== "active") {
    await recordLoginEvent("failed", meta, user.id, ident);
    return { ok: false, reason: "disabled" };
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: now })
    .where(eq(users.id, user.id));
  await recordLoginEvent("login", meta, user.id, ident);
  return { ok: true, userId: user.id };
}
