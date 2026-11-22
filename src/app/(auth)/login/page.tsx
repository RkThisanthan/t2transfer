import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Icon } from "@/components/ui/icon";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in" };

// Figma: "Desktop login" (5:3834) at lg and up, "Mobile login" (5:4288) below.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col bg-white leading-[normal] lg:flex-row lg:gap-12 lg:p-6">
      {/* Mobile brand accent bar */}
      <div aria-hidden="true" className="flex h-1 w-full shrink-0 lg:hidden">
        <div className="h-1 flex-1 bg-brand" />
        <div className="h-1 w-[52px] bg-accent-orange" />
        <div className="h-1 w-8 bg-accent-green" />
      </div>

      {/* Desktop: admin introduction panel */}
      <section
        aria-label="T2Transfer Admin Panel"
        className="relative hidden min-h-[640px] flex-[660_1_660px] flex-col justify-between overflow-hidden rounded-[var(--radius-panel)] bg-navy-900 p-12 lg:flex"
      >
        <Image
          src="/images/admin-photography.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 46vw, 0px"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[rgba(16,46,73,0.13)] via-[rgba(16,46,73,0.06)] via-35% to-[rgba(16,46,73,0.96)]"
        />

        <div className="relative inline-flex items-center gap-2 self-start rounded-full bg-white/92 px-3.5 py-[9px]">
          <Icon name="route" size={18} />
          <span className="text-[12px] font-semibold text-navy-900">T2Transfer Admin Panel</span>
        </div>

        <div className="relative flex flex-col gap-6">
          <h2 className="text-[46px] leading-[1.12] font-normal text-white">
            Admin access.
            <br />
            Control every transfer.
          </h2>
          <p className="max-w-[470px] text-[16px] leading-[1.6] text-mist">
            Manage reservations, rates, testimonials, driver assignments, and voucher codes from one secure workspace.
          </p>
          <div aria-hidden="true" className="flex items-center gap-2">
            <span className="h-1 w-7 rounded-[2px] bg-brand" />
            <span className="h-1 w-3 rounded-[2px] bg-accent-orange" />
            <span className="h-1 w-3 rounded-[2px] bg-accent-green" />
          </div>
        </div>
      </section>

      {/* Login workspace */}
      <section className="flex flex-1 flex-col gap-14 px-7 pt-9 pb-8 lg:flex-[684_1_684px] lg:gap-0 lg:px-16 lg:py-12">
        <Image
          src="/images/t2transfer-logo.png"
          alt="T2Transfer"
          width={160}
          height={58}
          priority
          className="h-[57.6px] w-40 object-contain"
        />

        <div className="flex w-full lg:flex-1 lg:items-center">
          <div className="w-full lg:max-w-[556px]">
            <LoginForm next={typeof next === "string" ? next : undefined} />
          </div>
        </div>

        <footer className="flex flex-col items-center gap-3.5 lg:max-w-[556px]">
          <p className="flex items-center gap-2 text-[11px] text-muted lg:text-[12px]">
            <span className="flex lg:hidden">
              <Icon name="shield-check-16" size={16} />
            </span>
            <span className="hidden lg:flex">
              <Icon name="shield-check" size={15} />
            </span>
            Secure access for the T2Transfer team
          </p>
          <p className="text-center text-[12px] text-muted lg:hidden">Smooth journeys. Seamless operations.</p>
        </footer>
      </section>
    </main>
  );
}
