import { Icon } from "./icon";

/**
 * Collapsible filter panel used on list pages (Reservations, Locations, …).
 * Closed by default, open while any filter is active so the user sees what is applied.
 * Built on <details>, so it opens and closes without JavaScript and works with the keyboard.
 */
export function FilterAccordion({ title, activeCount, children }: { title: string; activeCount: number; children: React.ReactNode }) {
  return (
    <details open={activeCount > 0} className="group rounded-xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 hover:bg-footer lg:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <Icon name="sliders-horizontal" size={18} />
          <h2 className="text-[16px] text-ink">{title}</h2>
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-dark">
              {activeCount} {activeCount === 1 ? "filter" : "filters"} active
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-dark">
          <span className="hidden sm:inline sm:group-open:hidden">Show filters</span>
          <span className="hidden sm:group-open:inline">Hide filters</span>
          <Icon name="chevron-up" size={16} className="rotate-180 transition-transform duration-200 group-open:rotate-0" />
        </span>
      </summary>
      <div className="border-t border-line p-4 lg:p-6">{children}</div>
    </details>
  );
}
