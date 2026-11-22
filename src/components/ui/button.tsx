import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

// Figma "Action" component: 44px high, 8px radius, 13px semibold.
type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "border-brand bg-brand text-white hover:bg-brand-dark hover:border-brand-dark",
  secondary: "border-line bg-white text-brand-dark hover:bg-brand-soft",
  danger: "border-danger-soft bg-white text-danger-ink hover:bg-danger-soft",
};

export function buttonClass(variant: Variant = "secondary", extra = "") {
  return `inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${extra}`;
}

type Common = { variant?: Variant; icon?: IconName; children: ReactNode; className?: string };

export function Button({ variant, icon, children, className, ...props }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClass(variant, className)} {...props}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, icon, children, className, href }: Common & { href: string }) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </Link>
  );
}
