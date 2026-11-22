import type { Metadata } from "next";
import { ReservationList } from "@/components/reservations/reservation-list";
import { ReservationSearchPanel } from "@/components/reservations/search-panel";
import { ButtonLink } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { Pagination } from "@/components/ui/pagination";
import { can, requirePermission } from "@/server/auth/permissions";
import { RESERVATION_STATUSES, SITES, TRIP_TYPES } from "@/server/db/schema";
import { getLocationNames } from "@/server/reference-data";
import { listReservations, PAGE_SIZE, type ReservationFilters } from "@/server/reservations/service";
import { deleteReservationAction, restoreReservationAction } from "./actions";

export const metadata: Metadata = { title: "Reservations" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const oneOf = <T extends string>(list: readonly T[], v?: string) => (list.includes(v as T) ? (v as T) : undefined);

function parseFilters(sp: Search): ReservationFilters {
  return {
    q: one(sp.q),
    reference: one(sp.reference),
    pickupDate: isDate(one(sp.pickupDate)),
    createdDate: isDate(one(sp.createdDate)),
    status: oneOf(RESERVATION_STATUSES, one(sp.status)),
    site: oneOf(SITES, one(sp.site)),
    tripType: oneOf(TRIP_TYPES, one(sp.tripType)),
    deleted: one(sp.deleted) === "1",
    page: Number(one(sp.page)) || 1,
  };
}

// Figma "Desktop reservations" (5:3882) / "Mobile reservations" (5:4329).
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission("reservations.view");
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [result, names, canCreate, canEdit, canDelete] = await Promise.all([
    listReservations(filters),
    getLocationNames(),
    can(user, "reservations.create"),
    can(user, "reservations.edit"),
    can(user, "reservations.delete"),
  ]);

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== false && k !== "page") params.set(k, v === true ? "1" : String(v));
    params.set("page", String(page));
    return `/reservations?${params}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="TRANSFER MANAGEMENT"
        title="Reservations"
        actions={canCreate ? <ButtonLink href="/reservations/new" variant="primary" className="w-full lg:w-auto">New reservation</ButtonLink> : null}
      />
      {one(sp.deletedOk) ? (
        <p role="status" className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] text-ink">
          Reservation deleted. Turn on <span className="font-semibold">Show deleted</span> under More filters to restore it.
        </p>
      ) : null}
      {/* The key re-creates the search fields when the filters change (Reset, Back/Forward),
          so they always show the active filters even though the page is not reloaded. */}
      <ReservationSearchPanel key={JSON.stringify({ ...filters, page: undefined })} filters={filters} />
      <div>
        <ReservationList
          items={result.items}
          names={names}
          canEdit={canEdit}
          canDelete={canDelete}
          deleteAction={deleteReservationAction}
          restoreAction={restoreReservationAction}
          startNumber={(result.page - 1) * PAGE_SIZE + 1}
        />
        <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} total={result.total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
