import type { ReactNode } from "react";

// Figma "Page introduction" (5:3915): optional eyebrow, 32px title, optional description and actions.
export function PageIntro({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {eyebrow ? <p className="text-[11px] text-brand-dark">{eyebrow}</p> : null}
        <h1 className="text-[28px] font-bold text-ink lg:text-[32px]">{title}</h1>
        {description ? <p className="text-[14px] leading-[1.5] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
