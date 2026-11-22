import Form from "next/form";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { SITE_NAMES, TRIP_LABELS } from "@/lib/format";
import type { ReservationFilters } from "@/server/reservations/service";

const fieldBox = "relative flex h-[46px] w-full items-center rounded-lg border border-line bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20";
const inputCls = "date-input min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted";
const labelCls = "text-[12px] font-semibold text-ink";
const selectCls = "h-[46px] w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const searchBtn = (primary: boolean) =>
  `flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    primary ? "border-brand bg-brand text-white hover:bg-brand-dark" : "border-line bg-white text-brand-dark hover:bg-brand-soft"
  }`;

function DateField({ id, name, label, value }: { id: string; name: string; label: string; value?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className={fieldBox}>
        <input id={id} name={name} type="date" defaultValue={value} className={inputCls} />
        <Icon name="calendar-days" size={18} className="pointer-events-none" />
      </div>
    </div>
  );
}

function SelectField({ id, label, value, options }: { id: string; label: string; value?: string; options: Record<string, string> }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <select id={id} name={id} defaultValue={value ?? ""} className={selectCls}>
        <option value="">All</option>
        {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

const STATUS_OPTIONS = { pending: "Pending", confirmed: "Confirmed", cancelled: "Cancelled" };

// One search block for every filter (P1-RES-06): all fields combine, one Search and one Reset.
// Based on Figma "Reservation search" (5:3923); the "Daily plan" search stays on the old panel until Phase 3.
export function ReservationSearchPanel({ filters }: { filters: ReservationFilters }) {
  // Accordion: closed by default, open while any filter is active (so the user sees what is applied).
  const activeCount = [filters.pickupDate, filters.createdDate, filters.reference, filters.q, filters.status, filters.site, filters.tripType, filters.deleted].filter(Boolean).length;
  return (
    <details open={activeCount > 0} className="group rounded-xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 hover:bg-footer lg:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <Icon name="sliders-horizontal" size={18} />
          <h2 id="find-heading" className="text-[16px] text-ink">Find reservations</h2>
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

      <Form action="/reservations" scroll={false} className="flex flex-col gap-4 border-t border-line p-4 lg:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DateField id="pickupDate" name="pickupDate" label="Pickup date" value={filters.pickupDate} />
          <DateField id="createdDate" name="createdDate" label="Created date" value={filters.createdDate} />
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="reference" className={labelCls}>Reference</label>
            <div className={fieldBox}>
              <input id="reference" name="reference" defaultValue={filters.reference} placeholder="Reference no." className={inputCls} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="q" className={labelCls}>Name, email or phone</label>
            <div className={fieldBox}>
              <input id="q" name="q" defaultValue={filters.q} placeholder="Search…" className={inputCls} />
            </div>
          </div>
          <SelectField id="status" label="Status" value={filters.status} options={STATUS_OPTIONS} />
          <SelectField id="site" label="Site" value={filters.site} options={SITE_NAMES} />
          <SelectField id="tripType" label="Trip type" value={filters.tripType} options={TRIP_LABELS} />
          <label className="flex h-[46px] items-center gap-2 self-end text-[13px] text-ink">
            <input type="checkbox" name="deleted" value="1" defaultChecked={filters.deleted} className="size-4 accent-brand" />
            Show deleted
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-start">
          <button type="submit" className={`${searchBtn(true)} sm:w-56`}>
            <Icon name="search-white" size={18} />
            Search
          </button>
          <Link href="/reservations" scroll={false} className={`${searchBtn(false)} sm:w-40`}>
            Reset
          </Link>
        </div>
      </Form>
    </details>
  );
}
