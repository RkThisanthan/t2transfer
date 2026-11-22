import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { IDLE_TIMEOUT_MS, REMEMBER_MS, SESSION_COOKIE, TOUCH_INTERVAL_MS } from "./config";
import type { RequestMeta } from "./request-meta";

export type SessionUser = { id: number; name: string; username: string; email: string };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a session row and sets the cookie. Call only from a Server Action or Route Handler. */
export async function createSession(userId: number, remember: boolean, meta: RequestMeta) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (remember ? REMEMBER_MS : IDLE_TIMEOUT_MS));

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    remember,
    expiresAt,
    lastSeenAt: now,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Without "Remember Me" this is a browser-session cookie; the server still enforces the idle timeout.
    ...(remember ? { expires: expiresAt } : {}),
  });
}

/** Returns the signed-in user, or null. Safe to call from Server Components. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const id = hashToken(token);
  const now = new Date();
  const rows = await db
    .select({
      session: { id: sessions.id, remember: sessions.remember, lastSeenAt: sessions.lastSeenAt },
      user: { id: users.id, name: users.name, username: users.username, email: users.email, status: users.status, deletedAt: users.deletedAt },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
    .limit(1);

  const row = rows[0];
  if (!row || row.user.status !== "active" || row.user.deletedAt) return null;

  // Slide the idle timeout for normal sessions (P1-AUTH-06); "remember" sessions keep a fixed expiry.
  if (now.getTime() - row.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set(row.session.remember ? { lastSeenAt: now } : { lastSeenAt: now, expiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS) })
      .where(eq(sessions.id, id));
  }

  const { id: userId, name, username, email } = row.user;
  return { id: userId, name, username, email };
});

/** Deletes the current session and clears the cookie. Returns the user id it belonged to, if any. */
export async function destroyCurrentSession(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (!token) return null;

  const id = hashToken(token);
  const [row] = await db.select({ userId: sessions.userId }).from(sessions).where(eq(sessions.id, id)).limit(1);
  await db.delete(sessions).where(eq(sessions.id, id));
  return row?.userId ?? null;
}

/** Ends every session of a user, e.g. when the account is disabled (P1-AUTH-07). */
export async function destroyUserSessions(userId: number) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
