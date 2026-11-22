import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db/client";
import { permissionRole, permissions, roleUser, roles } from "@/server/db/schema";
import { requireUser } from "./guard";
import type { SessionUser } from "./session";

export type PermissionKey =
  | "users.view" | "users.manage" | "roles.manage" | "audit.view" | "api_clients.manage"
  | "reservations.view" | "reservations.create" | "reservations.edit" | "reservations.delete"
  | "dashboard.daily_chart" | "cs.own_records" | "cs.view_all"
  | "locations.view" | "locations.manage" | "rates.view" | "rates.manage"
  | "vouchers.view" | "vouchers.manage" | "testimonials.view" | "testimonials.manage";

/** All permission keys of a user, from every role they hold (P1-USR-02). Super Admin has all. */
export const getPermissions = cache(async (userId: number): Promise<Set<string>> => {
  const rows = await db
    .select({ roleKey: roles.key, permKey: permissions.key })
    .from(roleUser)
    .innerJoin(roles, eq(roles.id, roleUser.roleId))
    .leftJoin(permissionRole, eq(permissionRole.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, permissionRole.permissionId))
    .where(eq(roleUser.userId, userId));

  if (rows.some((r) => r.roleKey === "super_admin")) {
    const all = await db.select({ key: permissions.key }).from(permissions);
    return new Set(all.map((p) => p.key));
  }
  return new Set(rows.flatMap((r) => (r.permKey ? [r.permKey] : [])));
});

export async function can(user: SessionUser, key: PermissionKey): Promise<boolean> {
  return (await getPermissions(user.id)).has(key);
}

/** Page and action guard (P1-USR-05): signed in AND holding the permission, otherwise 403. */
export async function requirePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await can(user, key))) redirect("/forbidden");
  return user;
}
