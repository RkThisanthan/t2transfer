// Seeds roles, Phase 1 permissions and the first Super Admin. Safe to run more than once.
// Usage: npm run db:seed   (reads .env.local)
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/server/auth/password";
import { db } from "../src/server/db/client";
import { permissionRole, permissions, roleUser, roles, users } from "../src/server/db/schema";

const ROLES = [
  { key: "super_admin", name: "Super Admin", description: "Full access to every module", isSystem: true },
  { key: "planner", name: "Planner / Dispatcher", description: "Plans and manages reservations", isSystem: true },
  { key: "accountant", name: "Accountant", description: "Accounting and finance", isSystem: true },
  { key: "customer_service", name: "Customer Service", description: "Customer service staff", isSystem: true },
  { key: "driver", name: "Driver", description: "Driver app users (Phase 3)", isSystem: true },
  { key: "agent", name: "Agent / Influencer", description: "Agent portal users (Phase 5)", isSystem: true },
];

// Phase 1 permission keys (spec Section 3).
const PERMISSIONS: Array<[key: string, module: string]> = [
  ["users.view", "users"], ["users.manage", "users"], ["roles.manage", "roles"], ["audit.view", "audit"],
  ["api_clients.manage", "api_clients"],
  ["reservations.view", "reservations"], ["reservations.create", "reservations"], ["reservations.edit", "reservations"], ["reservations.delete", "reservations"],
  ["dashboard.daily_chart", "dashboard"],
  ["cs.own_records", "cs"], ["cs.view_all", "cs"],
  ["locations.view", "locations"], ["locations.manage", "locations"],
  ["rates.view", "rates"], ["rates.manage", "rates"],
  ["vouchers.view", "vouchers"], ["vouchers.manage", "vouchers"],
  ["testimonials.view", "testimonials"], ["testimonials.manage", "testimonials"],
];

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set in .env.local`);
  return v;
}

async function main() {
  for (const r of ROLES) {
    await db.insert(roles).values(r).onDuplicateKeyUpdate({ set: { name: r.name, description: r.description } });
  }
  for (const [key, module] of PERMISSIONS) {
    await db.insert(permissions).values({ key, module }).onDuplicateKeyUpdate({ set: { module } });
  }

  const [superAdmin] = await db.select().from(roles).where(eq(roles.key, "super_admin"));
  const allPerms = await db.select({ id: permissions.id }).from(permissions);
  for (const p of allPerms) {
    await db.insert(permissionRole).values({ roleId: superAdmin.id, permissionId: p.id }).onDuplicateKeyUpdate({ set: { roleId: superAdmin.id } });
  }

  const username = env("SEED_ADMIN_USERNAME");
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  let userId = existing?.id;
  if (!userId) {
    const password = env("SEED_ADMIN_PASSWORD");
    if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");
    const [res] = await db.insert(users).values({
      name: env("SEED_ADMIN_NAME"),
      username,
      email: env("SEED_ADMIN_EMAIL").toLowerCase(),
      passwordHash: await hashPassword(password),
    });
    userId = res.insertId;
    console.log(`Created Super Admin "${username}".`);
  } else {
    console.log(`User "${username}" already exists; password left unchanged.`);
  }
  await db.insert(roleUser).values({ userId, roleId: superAdmin.id }).onDuplicateKeyUpdate({ set: { userId } });

  console.log(`Seeded ${ROLES.length} roles and ${PERMISSIONS.length} permissions.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
