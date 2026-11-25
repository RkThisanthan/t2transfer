import { AppHeader } from "@/components/shell/app-header";
import type { NavItem } from "@/components/shell/primary-nav";
import { requireUser } from "@/server/auth/guard";
import { getPermissions, type PermissionKey } from "@/server/auth/permissions";

const NAV: Array<NavItem & { permission?: PermissionKey }> = [
  { href: "/reservations", label: "Reservations", icon: "/icons/nav-calendar-days.svg", permission: "reservations.view" },
  { href: "/locations", label: "Locations", icon: "/icons/map-pin.svg", permission: "locations.view" },
  // { href: "/rates", label: "Rates", icon: "/icons/nav-badge-dollar-sign.svg", permission: "rates.view" },
  // { href: "/testimonials", label: "Testimonials", icon: "/icons/nav-message-square.svg", permission: "testimonials.view" },
  // { href: "/driver-assign", label: "Driver Assign", icon: "/icons/nav-car-front.svg" },
  // { href: "/vouchers", label: "Voucher Codes", icon: "/icons/nav-ticket.svg", permission: "vouchers.view" },
];

// Every page under (app) requires a valid session; the menu only shows what the user may open (P1-USR-04).
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const perms = await getPermissions(user.id);
  const nav = NAV.filter((n) => !n.permission || perms.has(n.permission)).map(({ permission: _p, ...n }) => n);

  return (
    <div className="min-h-dvh bg-canvas leading-[normal]">
      <AppHeader user={user} nav={nav} />
      <main className="px-4 pt-6 pb-6 lg:px-10 lg:pt-8">{children}</main>
    </div>
  );
}
