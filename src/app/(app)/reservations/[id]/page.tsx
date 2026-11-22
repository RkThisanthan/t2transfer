import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteReservationButton, RestoreReservationButton } from "@/components/reservations/delete-button";
import { DepartureLeg, OutboundLeg } from "@/components/reservations/leg-summary";
import { StatusBadge } from "@/components/reservations/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { formatInstant, formatMoney, PAYMENT_LABELS, SITE_NAMES, TRIP_LABELS, VEHICLE_LABELS } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/permissions";
import { getLocationNames } from "@/server/reference-data";
import { getReservationHistory } from "@/server/reservations/history";
import { getReservation } from "@/server/reservations/service";
import { getUserNames } from "@/server/users";
import { deleteReservationAction, restoreReservationAction } from "../actions";

export const metadata: Metadata = { title: "Reservation" };

const NOTICES: Record<string, string> = { created: "Reservation created.", saved: "Changes saved.", restored: "Reservation restored." };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-[14px] leading-[1.5] font-medium break-words text-ink">{children}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4 lg:p-6">
      <h2 className="mb-5 text-[16px] text-ink">{title}</h2>
      {children}
    </section>
  );
}

const HISTORY_LABELS = { create: "Created", update: "Edited", delete: "Deleted", restore: "Restored" } as const;

// "paymentStatus" → "payment status", "leg.departure" → "departure transfer"
const fieldLabel = (key: string) =>
  key.startsWith("leg.") ? `${key.slice(4)} transfer` : key.replace(/([A-Z])/g, " $1").toLowerCase();

// P1-RES-07: every field of the reservation, plus its audit history.
export default async function ReservationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("reservations.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const [r, names, history, canEdit, canDelete] = await Promise.all([
    getReservation(id, { includeDeleted: true }),
    getLocationNames(),
    getReservationHistory(id),
    can(user, "reservations.edit"),
    can(user, "reservations.delete"),
  ]);
  if (!r) notFound();
  const userNames = await getUserNames([r.createdBy, r.updatedBy]);
  const who = (id: number | null) => (id ? userNames.get(id) ?? `User #${id}` : r.source === "api" ? "Website (Booking API)" : r.source === "legacy" ? "Old system" : "—");

  const deleted = Boolean(r.deletedAt);
  const notice = Object.keys(NOTICES).find((k) => sp[k]);
  const legsTotal = r.legs.reduce((s, l) => s + Number(l.rate) + Number(l.nightCharge), 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-brand-dark">RESERVATION · ID {r.id}</p>
          <h1 className="text-[28px] font-bold text-ink lg:text-[32px]">{r.reference}</h1>
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <StatusBadge status={r.status} deleted={deleted} />
            <span>{SITE_NAMES[r.site]}</span>
            <span>·</span>
            <span>{TRIP_LABELS[r.tripType]}</span>
            <span>·</span>
            <span>Created {formatInstant(r.createdAt)} ({r.source === "api" ? "website" : r.source})</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <ButtonLink href="/reservations" className="w-full sm:w-auto">Back to list</ButtonLink>
          {canEdit && !deleted ? <ButtonLink href={`/reservations/${r.id}/edit`} icon="pencil" className="w-full sm:w-auto">Edit</ButtonLink> : null}
          {canDelete && !deleted ? <DeleteReservationButton action={deleteReservationAction.bind(null, r.id)} reference={r.reference} /> : null}
          {canDelete && deleted ? <RestoreReservationButton action={restoreReservationAction.bind(null, r.id)} /> : null}
        </div>
      </div>

      {notice ? <p role="status" className="rounded-lg border border-green-ink/30 bg-green-soft px-4 py-3 text-[13px] text-green-ink">{NOTICES[notice]}</p> : null}
      {deleted ? <p className="rounded-lg border border-line bg-white px-4 py-3 text-[13px] text-muted">Deleted {formatInstant(r.deletedAt)}. Restore it to edit.</p> : null}

      <Card title="Booking details">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Item label="Reference">{r.reference}</Item>
          <Item label="Reservation ID">{r.id}</Item>
          <Item label="Status"><StatusBadge status={r.status} deleted={deleted} /></Item>
          <Item label="Trip type">{TRIP_LABELS[r.tripType]}</Item>
          <Item label="Site">{SITE_NAMES[r.site]} ({r.site})</Item>
          <Item label="Vehicle">{VEHICLE_LABELS[r.vehicleClass]}</Item>
          <Item label="Booked via">{r.source === "api" ? "Website (Booking API)" : r.source === "legacy" ? "Old system (migrated)" : "Admin panel"}</Item>
          {r.legacyId ? <Item label="Old system ID">{r.legacyId}</Item> : null}
          <Item label="Created">{formatInstant(r.createdAt)}</Item>
          <Item label="Created by">{who(r.createdBy)}</Item>
          <Item label="Last updated">{formatInstant(r.updatedAt)}</Item>
          <Item label="Updated by">{who(r.updatedBy)}</Item>
          {deleted ? <Item label="Deleted">{formatInstant(r.deletedAt)}</Item> : null}
        </dl>
      </Card>

      <Card title="Journey">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <OutboundLeg leg={r.legs.find((l) => l.kind !== "departure")} names={names} />
          <div aria-hidden="true" className="h-px bg-line lg:h-auto lg:w-px" />
          <DepartureLeg leg={r.legs.find((l) => l.kind === "departure")} names={names} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Customer">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Item label="Name">{[r.title, r.firstName, r.lastName].filter(Boolean).join(" ")}</Item>
            <Item label="Email"><a href={`mailto:${r.email}`} className="text-brand-dark hover:underline">{r.email}</a></Item>
            <Item label="Phone">{r.phone ? `${r.phoneCode ?? ""} ${r.phone}`.trim() : "—"}</Item>
            <Item label="Phone code">{r.phoneCode || "—"}</Item>
            <Item label="UTM source">{r.utmSource || "—"}</Item>
            <Item label="UTM medium">{r.utmMedium || "—"}</Item>
          </dl>
        </Card>
        <Card title="Passengers and luggage">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Item label="Adults">{r.adults}</Item>
            <Item label="Children">{r.children}</Item>
            <Item label="Babies">{r.babies}</Item>
            <Item label="Vehicle">{VEHICLE_LABELS[r.vehicleClass]}</Item>
            <Item label="Small">{r.luggageSmall}</Item>
            <Item label="Large">{r.luggageLarge}</Item>
            <Item label="Extra-large">{r.luggageXl}</Item>
            <Item label="Trolleys">{r.trolleys}</Item>
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Price and payment">
          <dl className="grid gap-4 sm:grid-cols-2">
            {r.legs.map((l) => {
              const label = `${l.kind[0].toUpperCase()}${l.kind.slice(1)}`;
              return [
                <Item key={`${l.kind}-rate`} label={`${label} rate`}>{formatMoney(l.rate)}</Item>,
                <Item key={`${l.kind}-night`} label={`${label} night charge`}>{formatMoney(l.nightCharge)}</Item>,
                <Item key={`${l.kind}-vat`} label={`${label} VAT`}>{Number(l.vatRate) > 0 ? `${Number(l.vatRate)}%` : "Not set"}</Item>,
              ];
            })}
            <Item label="Vehicle upgrade">{formatMoney(r.upgradeCost)}</Item>
            <Item label="Voucher code">{r.voucherCode || "—"}</Item>
            <Item label="Discount">− {formatMoney(r.discount)}</Item>
            <Item label="Payment method">{r.paymentMethod ? PAYMENT_LABELS[r.paymentMethod] : "Not set"}</Item>
            <Item label="Payment status">{r.paymentStatus === "paid" ? "Paid" : "Unpaid"}</Item>
            <Item label={`Total (${r.currency})`}><span className="text-[18px] font-bold">{formatMoney(r.total, r.currency)}</span></Item>
          </dl>
          {r.source === "api" && legsTotal === 0 ? (
            <p className="mt-4 text-[12px] text-muted">Website bookings are not priced yet: the rates module comes later in Phase 1. Set the rates by editing the reservation.</p>
          ) : null}
        </Card>
        <Card title="Notes">
          <dl className="grid gap-4">
            <Item label="Client comments">{r.clientComments || "—"}</Item>
            <Item label="Special notes (staff only)">{r.specialNotes || "—"}</Item>
          </dl>
        </Card>
      </div>

      <Card title="History">
        {history.length === 0 ? (
          <p className="text-[13px] text-muted">No recorded changes.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {history.map((h) => {
              const changed = h.action === "update" && h.newValues ? Object.keys(h.newValues).map(fieldLabel) : [];
              return (
                <li key={h.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
                  <span className="w-44 shrink-0 text-[13px] text-muted">{formatInstant(h.createdAt)}</span>
                  <span className="text-[13px] text-ink">
                    <span className="font-semibold">{HISTORY_LABELS[h.action]}</span> by {h.userName ?? (h.apiClientName ? `website (${h.apiClientName})` : "system")}
                    {changed.length ? <span className="text-muted"> · {changed.join(", ")}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
