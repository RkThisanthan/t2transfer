import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/(app)/actions";
import { Icon } from "@/components/ui/icon";
import type { SessionUser } from "@/server/auth/session";
import { PrimaryNav, type NavItem } from "./primary-nav";

// Figma "Workspace navigation" (5:3883): 88px brand bar + primary navigation.
export function AppHeader({ user, nav }: { user: SessionUser; nav: NavItem[] }) {
  return (
    // Fixed at the top on desktop (88px bar + 52px nav + borders = 142px; sticky table headers sit below it).
    // On phones the menu wraps onto several rows, so the header scrolls away to keep the screen free.
    <header className="bg-white lg:sticky lg:top-0 lg:z-40">
      <div className="flex h-[72px] items-center justify-between px-4 lg:h-[88px] lg:px-10">
        <Link href="/reservations" aria-label="T2Transfer Admin home">
          <Image src="/images/t2transfer-logo.png" alt="T2Transfer" width={160} height={58} priority className="h-[46px] w-32 object-contain lg:h-[57.6px] lg:w-40" />
        </Link>
        <div className="flex items-center gap-3 lg:gap-5">
          <span aria-hidden="true" className="flex size-[34px] items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand-dark">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="text-[13px] font-semibold text-ink">{user.username}</span>
          <form action={logoutAction} className="hidden lg:block">
            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-lg bg-canvas px-4 text-[13px] font-semibold text-brand-dark hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand"
            >
              <Icon name="log-out" size={18} />
              Log Out
            </button>
          </form>
        </div>
      </div>
      <PrimaryNav items={nav} logoutAction={logoutAction} />
    </header>
  );
}
