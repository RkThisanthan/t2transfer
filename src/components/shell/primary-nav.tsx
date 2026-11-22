"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaskIcon } from "@/components/ui/icon";

export type NavItem = { href: string; label: string; icon: string };

// Figma "Primary navigation" (5:3898): 52px items, 28px gap, active = soft blue with 3px underline.
export function PrimaryNav({ items, logoutAction }: { items: NavItem[]; logoutAction: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="border-y border-line px-4 lg:px-10">
      <ul className="flex flex-wrap gap-x-2 gap-y-1 py-2 lg:gap-7 lg:py-0">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-[7px] rounded-lg px-2.5 text-[13px] lg:h-[52px] lg:rounded-none lg:px-0 ${
                  active
                    ? "bg-brand-soft text-brand-dark lg:border-b-3 lg:border-brand lg:px-1"
                    : "font-medium text-muted hover:text-ink"
                }`}
              >
                <MaskIcon src={item.icon} size={16} />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="lg:hidden">
          <form action={logoutAction}>
            <button type="submit" className="flex h-10 items-center gap-1 px-2.5 text-[13px] font-medium text-muted hover:text-ink">
              Log Out <span aria-hidden="true">↗</span>
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
