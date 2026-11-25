import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { FilterAccordion } from "@/components/ui/filter-accordion";
import { Icon } from "@/components/ui/icon";
import { PageIntro } from "@/components/ui/page-intro";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE } from "@/server/reservations/service";
import { can, requirePermission } from "@/server/auth/permissions";
import { listLocations, listLocationTypes, type LocationFilters } from "@/server/locations/service";
import { LocationModalButton, LocationTypeModalButton } from "@/components/locations/location-modals";
import { deleteLocationAction, deleteLocationTypeAction, saveLocationAction, saveLocationTypeAction, setLocationActiveAction } from "./actions";

export const metadata: Metadata = { title: "Locations" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const NOTICES: Record<string, string> = {
  created: "Location created.",
  saved: "Location saved.",
  activated: "Location activated.",
  deactivated: "Location deactivated. It no longer appears in new bookings; existing bookings keep it.",
  deleted: "Location deleted.",
  "type-created": "Location type created.",
  "type-saved": "Location type saved.",
  "type-deleted": "Location type deleted.",
};

const fieldBox = "h-[46px] w-full rounded-lg border border-line bg-white px-3 text-[14px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
// Header cells stay visible while scrolling on desktop, just below the fixed app header (142px).
const th = "bg-canvas px-4 py-3.5 text-left text-[12px] font-extrabold text-ink first:pl-6 last:pr-6 lg:sticky lg:top-[142px] lg:z-10 lg:shadow-[inset_0_-1px_0_var(--color-line)]";
const td = "px-4 py-4 align-middle text-[14px] text-ink first:pl-6 last:pr-6";

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] uppercase ${active ? "bg-green-soft text-green-ink" : "bg-canvas text-muted"}`}>
      <span aria-hidden="true" className="size-1.5 rounded-[3px] bg-current" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// P1-LOC-01 / P1-LOC-02: locations and location types. Replaces legacy UC-16.
export default async function LocationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission("locations.view");
  const sp = await searchParams;
  const tab = one(sp.tab) === "types" ? "types" : "locations";
  const filters: LocationFilters = {
    q: one(sp.q),
    typeId: Number(one(sp.typeId)) || undefined,
    status: one(sp.status) === "active" || one(sp.status) === "inactive" ? (one(sp.status) as "active" | "inactive") : undefined,
  };
  const [canManage, types, allRows] = await Promise.all([
    can(user, "locations.manage"),
    listLocationTypes(),
    tab === "locations" ? listLocations(filters) : Promise.resolve([]),
  ]);

  // Pagination (same component and page size as Reservations). The list is small, so it is sliced in memory.
  const pageCount = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(one(sp.page)) || 1), pageCount);
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.typeId) params.set("typeId", String(filters.typeId));
    if (filters.status) params.set("status", filters.status);
    params.set("page", String(p));
    return `/locations?${params}`;
  };

  const notice = NOTICES[one(sp.notice) ?? ""];
  const error = one(sp.error);

  const tabLink = (key: "locations" | "types", label: string, n: number) => (
    <Link
      href={key === "types" ? "/locations?tab=types" : "/locations"}
      aria-current={tab === key ? "page" : undefined}
      className={`flex h-11 items-center gap-2 border-b-3 px-1 text-[14px] ${tab === key ? "border-brand font-semibold text-brand-dark" : "border-transparent text-muted hover:text-ink"}`}
    >
      {label}
      <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-muted">{n}</span>
    </Link>
  );
  const totalLocations = types.reduce((s, t) => s + t.locationCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Locations"
        actions={
          canManage ? (
            tab === "types" ? (
              <LocationTypeModalButton
                label="New location type"
                variant="primary"
                buttonClassName="w-full lg:w-auto"
                title="New location type"
                description="Types group the places in the booking form, e.g. Paris Airports."
                action={saveLocationTypeAction.bind(null, null)}
                initial={{ sortOrder: "100" }}
                submitLabel="Create type"
              />
            ) : (
              <LocationModalButton
                label="New location"
                variant="primary"
                buttonClassName="w-full lg:w-auto"
                title="New location"
                action={saveLocationAction.bind(null, null)}
                initial={{ sortOrder: "10000", locationTypeId: filters.typeId ? String(filters.typeId) : "" }}
                types={types}
                submitLabel="Create location"
              />
            )
          ) : null
        }
      />

      {notice ? <p role="status" className="rounded-lg border border-green-ink/30 bg-green-soft px-4 py-3 text-[13px] text-green-ink">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">{error}</p> : null}

      <nav aria-label="Location sections" className="flex gap-6 border-b border-line">
        {tabLink("locations", "Locations", totalLocations)}
        {tabLink("types", "Location types", types.length)}
      </nav>

      {tab === "locations" ? (
        <>
          <FilterAccordion key={JSON.stringify(filters)} title="Find locations" activeCount={[filters.q, filters.typeId, filters.status].filter(Boolean).length}>
          <Form action="/locations" scroll={false} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
            <div className="flex flex-col gap-2">
              <label htmlFor="q" className="text-[12px] font-semibold text-ink">Name</label>
              <input id="q" name="q" defaultValue={filters.q} placeholder="Search locations…" className={fieldBox} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="typeId" className="text-[12px] font-semibold text-ink">Type</label>
              <select id="typeId" name="typeId" defaultValue={filters.typeId ?? ""} className={fieldBox}>
                <option value="">All types</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="status" className="text-[12px] font-semibold text-ink">Status</label>
              <select id="status" name="status" defaultValue={filters.status ?? ""} className={fieldBox}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className={buttonClass("primary", "flex-1 lg:flex-none")}>
                <Icon name="search-white" size={18} />
                Search
              </button>
              <Link href="/locations" scroll={false} className={buttonClass("secondary")}>Reset</Link>
            </div>
          </Form>
          </FilterAccordion>

          <section className="overflow-x-auto rounded-xl border border-line bg-white lg:overflow-clip">
            {rows.length === 0 ? (
              <p className="px-6 py-10 text-center text-[14px] text-muted">No locations match these filters.</p>
            ) : (
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-canvas">
                  <tr>
                    <th className={`${th} w-14`}>#</th>
                    <th className={th}>Name</th>
                    <th className={th}>Type</th>
                    <th className={th}>Sort order</th>
                    <th className={th}>Used by</th>
                    <th className={th}>Status</th>
                    {canManage ? <th className={`${th} text-right`}>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l, i) => (
                    <tr key={l.id} className="border-t border-line">
                      {/* Row number continues across pages (page 2 starts at 21), as on Reservations */}
                      <td className={`${td} font-semibold text-muted`}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className={`${td} font-semibold`}>{l.name}</td>
                      <td className={td}>{l.typeName}</td>
                      <td className={`${td} text-muted`}>{l.sortOrder}</td>
                      <td className={`${td} text-muted`}>{l.usage === 0 ? "Not used" : `${l.usage} transfer${l.usage === 1 ? "" : "s"}`}</td>
                      <td className={td}><Badge active={l.isActive} /></td>
                      {canManage ? (
                        <td className={`${td} text-right`}>
                          <div className="flex justify-end gap-2">
                            <LocationModalButton
                              label="Edit"
                              icon="pencil"
                              title={`Edit ${l.name}`}
                              description={l.usage > 0 ? `Used by ${l.usage} transfer${l.usage === 1 ? "" : "s"}. A new name also shows on those bookings.` : "Not used by any booking yet."}
                              action={saveLocationAction.bind(null, l.id)}
                              initial={{ name: l.name, locationTypeId: String(l.locationTypeId), sortOrder: String(l.sortOrder) }}
                              types={types}
                              submitLabel="Save changes"
                            />
                            {l.isActive ? (
                              <ConfirmActionButton
                                action={setLocationActiveAction.bind(null, l.id, false)}
                                label="Deactivate"
                                confirm={{
                                  title: "Deactivate this location?",
                                  message: <><span className="font-semibold text-ink">{l.name}</span> will no longer be offered in new bookings or on the website. Existing bookings keep it.</>,
                                  confirmLabel: "Deactivate",
                                }}
                              />
                            ) : (
                              <ConfirmActionButton
                                action={setLocationActiveAction.bind(null, l.id, true)}
                                label="Activate"
                                confirm={{ title: "Activate this location?", message: <><span className="font-semibold text-ink">{l.name}</span> can be chosen in bookings again.</>, confirmLabel: "Activate" }}
                              />
                            )}
                            {l.usage === 0 ? (
                              <ConfirmActionButton
                                action={deleteLocationAction.bind(null, l.id)}
                                label="Delete"
                                variant="danger"
                                icon="trash-2"
                                confirm={{
                                  title: "Delete this location?",
                                  message: <><span className="font-semibold text-ink">{l.name}</span> is not used by any booking and will be removed permanently.</>,
                                  confirmLabel: "Delete location",
                                  tone: "danger",
                                }}
                              />
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {allRows.length > 0 ? (
            <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} total={allRows.length} pageSize={PAGE_SIZE} itemLabel="locations" />
          ) : null}
        </>
      ) : (
        <section className="overflow-x-auto rounded-xl border border-line bg-white lg:overflow-clip">
          <table className="w-full min-w-[560px] border-collapse">
            <thead className="bg-canvas">
              <tr>
                <th className={`${th} w-14`}>#</th>
                <th className={th}>Name</th>
                <th className={th}>Sort order</th>
                <th className={th}>Locations</th>
                {canManage ? <th className={`${th} text-right`}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {types.map((t, i) => (
                <tr key={t.id} className="border-t border-line">
                  <td className={`${td} font-semibold text-muted`}>{i + 1}</td>
                  <td className={`${td} font-semibold`}>{t.name}</td>
                  <td className={`${td} text-muted`}>{t.sortOrder}</td>
                  <td className={td}>
                    <Link href={`/locations?typeId=${t.id}`} className="text-brand-dark hover:underline">{t.locationCount}</Link>
                  </td>
                  {canManage ? (
                    <td className={`${td} text-right`}>
                      <div className="flex justify-end gap-2">
                        <LocationTypeModalButton
                          label="Edit"
                          icon="pencil"
                          title={`Edit ${t.name}`}
                          action={saveLocationTypeAction.bind(null, t.id)}
                          initial={{ name: t.name, sortOrder: String(t.sortOrder) }}
                          submitLabel="Save changes"
                        />
                        {t.locationCount === 0 ? (
                          <ConfirmActionButton
                            action={deleteLocationTypeAction.bind(null, t.id)}
                            label="Delete"
                            variant="danger"
                            icon="trash-2"
                            confirm={{ title: "Delete this location type?", message: <><span className="font-semibold text-ink">{t.name}</span> has no locations and will be removed.</>, confirmLabel: "Delete type", tone: "danger" }}
                          />
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
