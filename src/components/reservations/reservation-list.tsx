import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatInstant, SITE_LABELS, TRIP_LABELS, VEHICLE_LABELS } from "@/lib/format";
import type { ReservationWithLegs } from "@/server/reservations/service";
import { DeleteReservationButton, RestoreReservationButton } from "./delete-button";
import { DepartureLeg, OutboundLeg } from "./leg-summary";
import { StatusBadge } from "./status-badge";

type Props = {
  items: ReservationWithLegs[];
  names: Map<number, string>;
  canEdit: boolean;
  canDelete: boolean;
  deleteAction: (id: number) => Promise<void>;
  restoreAction: (id: number) => Promise<void>;
  /** Number of the first row on this page (page 2 with 20 per page starts at 21). */
  startNumber?: number;
};

const fullName = (r: ReservationWithLegs) => [r.title, r.firstName, r.lastName].filter(Boolean).join(" ");

// Figma "Reservation results" (5:3960). Each row is a <details>, so it expands without JavaScript.
export function ReservationList({ items, names, canEdit, canDelete, deleteAction, restoreAction, startNumber = 1 }: Props) {
  return (
    // overflow-clip (not overflow-hidden) keeps the rounded corners without breaking the sticky column header.
    <section aria-labelledby="list-heading" className="overflow-clip rounded-xl border-line lg:border lg:bg-white">
      <div className="flex items-center justify-between py-[18px] lg:px-6">
        <h2 id="list-heading" className="text-[17px] text-ink">Reservation list</h2>
      </div>

      {/* Column header stays visible while scrolling through the list (desktop only; mobile shows cards). */}
      <div className="sticky top-0 z-10 hidden gap-6 border-b border-line bg-canvas px-6 py-3.5 text-[13px] font-extrabold text-ink lg:grid lg:grid-cols-[40px_230px_minmax(0,200px)_60px_160px_130px_170px_1fr]">
        <span>#</span>
        <span>Booking / Service</span>
        <span>Customer</span>
        <span>Site</span>
        <span>Trip type</span>
        <span>Status</span>
        <span>Created date</span>
        <span>Details</span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-white px-6 py-10 text-center text-[14px] text-muted lg:rounded-none lg:border-0">
          No reservations match these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-4 lg:gap-0">
          {items.map((r, i) => {
            const outbound = r.legs.find((l) => l.kind !== "departure");
            const departure = r.legs.find((l) => l.kind === "departure");
            const deleted = Boolean(r.deletedAt);
            return (
              <li key={r.id} className="overflow-hidden rounded-xl border border-line bg-white lg:rounded-none lg:border-0 lg:border-b">
                <details open={i === 0} className="group">
                  <summary className="cursor-pointer list-none p-4 hover:bg-footer lg:grid lg:grid-cols-[40px_230px_minmax(0,200px)_60px_160px_130px_170px_1fr] lg:items-center lg:gap-6 lg:p-6 [&::-webkit-details-marker]:hidden">
                    {/* Mobile: ID + status on one line, as in the mobile frame */}
                    <div className="mb-2 flex items-center justify-between lg:hidden">
                      <span className="text-[12px] text-muted">
                        <span className="font-semibold text-ink">#{startNumber + i}</span> · ID {r.id}
                      </span>
                      <StatusBadge status={r.status} deleted={deleted} />
                    </div>
                    {/* Row number (desktop column) */}
                    <span className="hidden text-[13px] font-semibold text-muted lg:block">{startNumber + i}</span>
                    <div className="flex flex-col gap-[5px]">
                      <Link href={`/reservations/${r.id}`} className="text-[15px] text-brand-dark hover:underline">
                        {r.reference}
                      </Link>
                      <span className="hidden text-[12px] whitespace-pre text-muted lg:block">{`ID ${r.id}  ·  ${VEHICLE_LABELS[r.vehicleClass]}`}</span>
                    </div>
                    <p className="mt-1 text-[14px] font-semibold break-words text-ink lg:mt-0">{fullName(r)}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px] lg:contents">
                      <div className="lg:hidden">
                        <dt className="text-[12px] text-muted">Service</dt>
                        <dd className="mt-1 text-ink">{VEHICLE_LABELS[r.vehicleClass]}</dd>
                      </div>
                      <div>
                        <dt className="text-[12px] text-muted lg:sr-only">Site</dt>
                        <dd className="mt-1 text-ink lg:mt-0">{SITE_LABELS[r.site]}</dd>
                      </div>
                      <div>
                        <dt className="text-[12px] text-muted lg:sr-only">Trip type</dt>
                        <dd className="mt-1 text-ink lg:mt-0">{TRIP_LABELS[r.tripType]}</dd>
                      </div>
                      <div className="hidden lg:block">
                        <StatusBadge status={r.status} deleted={deleted} />
                      </div>
                      <div className="col-span-2 lg:col-span-1">
                        <dt className="text-[12px] text-muted lg:sr-only">Created date</dt>
                        <dd className="mt-1 text-[13px] font-medium text-ink lg:mt-0 lg:font-normal">{formatInstant(r.createdAt)}</dd>
                      </div>
                    </dl>
                    <span className="hidden items-center gap-1.5 text-[12px] font-semibold text-brand-dark lg:flex">
                      <span className="group-open:hidden">Show details</span>
                      <span className="hidden group-open:inline">Hide details</span>
                      <Icon name="chevron-up" size={16} className="rotate-180 transition-transform group-open:rotate-0" />
                    </span>
                  </summary>

                  <div className="flex flex-col gap-6 border-t border-line p-4 lg:flex-row lg:gap-8 lg:p-6">
                    <OutboundLeg leg={outbound} names={names} />
                    <div aria-hidden="true" className="h-px bg-line lg:h-auto lg:w-px" />
                    <DepartureLeg leg={departure} names={names} />
                  </div>

                  <div className="flex flex-col gap-3 bg-footer p-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                    <p className="hidden text-[12px] text-muted lg:block">All booking fields are on the reservation page</p>
                    <div className="grid grid-cols-2 gap-2 lg:flex">
                      <ButtonLink href={`/reservations/${r.id}`} icon="external-link" className="w-full lg:w-auto">View</ButtonLink>
                      {canEdit && !deleted ? (
                        <ButtonLink href={`/reservations/${r.id}/edit`} icon="pencil" className="w-full lg:w-auto">Edit</ButtonLink>
                      ) : null}
                      {canDelete && !deleted ? <DeleteReservationButton action={deleteAction.bind(null, r.id)} reference={r.reference} /> : null}
                      {canDelete && deleted ? <RestoreReservationButton action={restoreAction.bind(null, r.id)} /> : null}
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
