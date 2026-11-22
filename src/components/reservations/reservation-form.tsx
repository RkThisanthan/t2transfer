"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ReservationFormState } from "@/app/(app)/reservations/actions";
import { buttonClass } from "@/components/ui/button";
import { PAYMENT_LABELS, SITE_NAMES, TRIP_LABELS, VEHICLE_LABELS, formatMoney } from "@/lib/format";
import type { LocationGroup } from "@/server/reference-data";

export type FormValues = Record<string, string>;
type Action = (prev: ReservationFormState, formData: FormData) => Promise<ReservationFormState>;

type Props = {
  action: Action;
  initial: FormValues;
  locationGroups: LocationGroup[];
  phoneCodes: { country: string; code: string }[];
  submitLabel: string;
  cancelHref: string;
  /** When set, saving asks for confirmation first (used on the edit page). */
  confirmSave?: { title: string; message: string; confirmLabel: string };
};

const LEGS_FOR_TRIP: Record<string, ("arrival" | "departure" | "single")[]> = {
  arrival: ["arrival"],
  departure: ["departure"],
  arrival_departure: ["arrival", "departure"],
  single: ["single"],
};

const control =
  "h-[46px] w-full rounded-lg border bg-white px-3 text-[14px] text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20";

export function ReservationForm({ action, initial, locationGroups, phoneCodes, submitLabel, cancelHref, confirmSave }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const [tripType, setTripType] = useState(values.tripType || "arrival");
  const [money, setMoney] = useState<FormValues>(() => pickMoney(values));

  const total = useMemo(() => {
    const legs = LEGS_FOR_TRIP[tripType] ?? [];
    const sum = legs.reduce((s, k) => s + num(money[`${k}.rate`]) + num(money[`${k}.nightCharge`]), 0) + num(money.upgradeCost) - num(money.discount);
    return Math.max(0, Math.round(sum * 100) / 100);
  }, [money, tripType]);

  const f = (name: string) => ({
    name,
    id: name,
    defaultValue: values[name] ?? "",
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    className: `${control} ${errors[name] ? "border-danger" : "border-line"}`,
  });
  const moneyField = (name: string) => ({
    ...f(name),
    type: "number",
    step: "0.01",
    min: "0",
    inputMode: "decimal" as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setMoney((m) => ({ ...m, [name]: e.target.value })),
  });

  const locationSelect = (name: string) => (
    <select {...f(name)}>
      <option value="">Choose a place</option>
      {locationGroups.map((g) => (
        <optgroup key={g.typeName} label={g.typeName}>
          {g.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </optgroup>
      ))}
    </select>
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        // Ask first; the confirm button re-submits with confirmedRef set.
        if (confirmSave && !confirmedRef.current) {
          e.preventDefault();
          setConfirmOpen(true);
          return;
        }
        confirmedRef.current = false;
      }}
    >
      {confirmSave ? (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmSave.title}
          message={confirmSave.message}
          confirmLabel={confirmSave.confirmLabel}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            confirmedRef.current = true;
            formRef.current?.requestSubmit();
          }}
        />
      ) : null}
      {state.formError ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">{state.formError}</p>
      ) : null}

      <Card title="Booking">
        <Grid>
          <Field label="Site" name="site" error={errors.site}>
            <select {...f("site")}>
              {Object.entries(SITE_NAMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Trip type" name="tripType" error={errors.tripType}>
            <select {...f("tripType")} value={tripType} defaultValue={undefined} onChange={(e) => setTripType(e.target.value)}>
              {Object.entries(TRIP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Status" name="status" error={errors.status}>
            <select {...f("status")}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Vehicle" name="vehicleClass" error={errors.vehicleClass}>
            <select {...f("vehicleClass")}>
              {Object.entries(VEHICLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </Grid>
      </Card>

      <Card title="Customer">
        <Grid>
          <Field label="Title" name="title" error={errors.title}>
            <select {...f("title")}>
              <option value="">—</option>
              <option>Mr</option>
              <option>Mrs</option>
              <option>Ms</option>
            </select>
          </Field>
          <Field label="First name" name="firstName" error={errors.firstName} required><input {...f("firstName")} autoComplete="off" /></Field>
          <Field label="Last name" name="lastName" error={errors.lastName} required><input {...f("lastName")} autoComplete="off" /></Field>
          <Field label="Email" name="email" error={errors.email} required><input {...f("email")} type="email" autoComplete="off" /></Field>
          <Field label="Phone code" name="phoneCode" error={errors.phoneCode}>
            <select {...f("phoneCode")}>
              <option value="">—</option>
              {phoneCodes.map((p, i) => <option key={i} value={p.code}>{`${p.country} (${p.code})`}</option>)}
            </select>
          </Field>
          <Field label="Phone" name="phone" error={errors.phone}><input {...f("phone")} type="tel" autoComplete="off" /></Field>
        </Grid>
      </Card>

      {(LEGS_FOR_TRIP[tripType] ?? []).map((kind) => (
        <Card key={kind} title={kind === "arrival" ? "Arrival transfer" : kind === "departure" ? "Departure transfer" : "Single transfer"} error={errors[kind]}>
          <Grid>
            {kind === "arrival" ? (
              <>
                <Field label="Arrival flight date and time" name="arrival.flightAt" error={errors["arrival.flightAt"]} required hint="Paris time">
                  <input {...f("arrival.flightAt")} type="datetime-local" />
                </Field>
                <Field label="Flight number" name="arrival.flightNo" error={errors["arrival.flightNo"]}><input {...f("arrival.flightNo")} /></Field>
                <Field label="Arriving from" name="arrival.flightCity" error={errors["arrival.flightCity"]}><input {...f("arrival.flightCity")} /></Field>
              </>
            ) : (
              <Field label="Pickup date and time" name={`${kind}.pickupAt`} error={errors[`${kind}.pickupAt`]} required hint="Paris time">
                <input {...f(`${kind}.pickupAt`)} type="datetime-local" />
              </Field>
            )}
            {kind === "departure" ? (
              <>
                <Field label="Departure flight date and time" name="departure.flightAt" error={errors["departure.flightAt"]} hint="Paris time">
                  <input {...f("departure.flightAt")} type="datetime-local" />
                </Field>
                <Field label="Flight number" name="departure.flightNo" error={errors["departure.flightNo"]}><input {...f("departure.flightNo")} /></Field>
                <Field label="Flying to" name="departure.flightCity" error={errors["departure.flightCity"]}><input {...f("departure.flightCity")} /></Field>
              </>
            ) : null}
            <Field label="Pickup place" name={`${kind}.pickupLocationId`} error={errors[`${kind}.pickupLocationId`]} required>
              {locationSelect(`${kind}.pickupLocationId`)}
            </Field>
            <Field label="Pickup address" name={`${kind}.pickupAddress`} error={errors[`${kind}.pickupAddress`]}><input {...f(`${kind}.pickupAddress`)} /></Field>
            <Field label="Drop place" name={`${kind}.dropLocationId`} error={errors[`${kind}.dropLocationId`]} required>
              {locationSelect(`${kind}.dropLocationId`)}
            </Field>
            <Field label="Drop address" name={`${kind}.dropAddress`} error={errors[`${kind}.dropAddress`]}><input {...f(`${kind}.dropAddress`)} /></Field>
            <Field label="Rate (EUR)" name={`${kind}.rate`} error={errors[`${kind}.rate`]}><input {...moneyField(`${kind}.rate`)} /></Field>
            <Field label="Night charge (EUR)" name={`${kind}.nightCharge`} error={errors[`${kind}.nightCharge`]}><input {...moneyField(`${kind}.nightCharge`)} /></Field>
            <Field label="VAT" name={`${kind}.vatRate`} error={errors[`${kind}.vatRate`]}>
              <select {...f(`${kind}.vatRate`)}>
                <option value="0">Not set</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
              </select>
            </Field>
          </Grid>
        </Card>
      ))}

      <Card title="Passengers and luggage">
        <Grid cols="lg:grid-cols-4">
          {[
            ["adults", "Adults"], ["children", "Children"], ["babies", "Babies"], ["trolleys", "Trolleys"],
            ["luggageSmall", "Small luggage"], ["luggageLarge", "Large luggage"], ["luggageXl", "Extra-large luggage"],
          ].map(([name, label]) => (
            <Field key={name} label={label} name={name} error={errors[name]} required={name === "adults"}>
              <input {...f(name)} type="number" min="0" step="1" inputMode="numeric" />
            </Field>
          ))}
        </Grid>
      </Card>

      <Card title="Price and payment">
        <Grid>
          <Field label="Vehicle upgrade cost (EUR)" name="upgradeCost" error={errors.upgradeCost}><input {...moneyField("upgradeCost")} /></Field>
          <Field label="Voucher code" name="voucherCode" error={errors.voucherCode}><input {...f("voucherCode")} /></Field>
          <Field label="Discount (EUR)" name="discount" error={errors.discount}><input {...moneyField("discount")} /></Field>
          <Field label="Payment method" name="paymentMethod" error={errors.paymentMethod}>
            <select {...f("paymentMethod")}>
              <option value="">Not set</option>
              {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Payment status" name="paymentStatus" error={errors.paymentStatus}>
            <select {...f("paymentStatus")}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <span className="text-[12px] font-semibold text-ink">Total</span>
            <output aria-live="polite" className="flex h-[46px] items-center rounded-lg bg-canvas px-3 text-[16px] font-bold text-ink">{formatMoney(total)}</output>
          </div>
        </Grid>
        <p className="mt-3 text-[12px] text-muted">Total = transfer rates + night charges + upgrade − discount. It is recalculated on the server when you save.</p>
      </Card>

      <Card title="Notes and source">
        <Grid cols="lg:grid-cols-2">
          <Field label="Client comments" name="clientComments" error={errors.clientComments}>
            <textarea {...f("clientComments")} rows={3} className={`${f("clientComments").className} h-auto py-2.5`} />
          </Field>
          <Field label="Special notes (staff only)" name="specialNotes" error={errors.specialNotes}>
            <textarea {...f("specialNotes")} rows={3} className={`${f("specialNotes").className} h-auto py-2.5`} />
          </Field>
          <Field label="UTM source" name="utmSource" error={errors.utmSource}><input {...f("utmSource")} /></Field>
          <Field label="UTM medium" name="utmMedium" error={errors.utmMedium}><input {...f("utmMedium")} /></Field>
        </Grid>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:flex-row sm:justify-end lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <Link href={cancelHref} className={buttonClass("secondary")}>Cancel</Link>
        <button type="submit" disabled={pending} className={buttonClass("primary", "min-w-40")}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : 0);
function pickMoney(values: FormValues): FormValues {
  return Object.fromEntries(Object.entries(values).filter(([k]) => /(rate|nightCharge|upgradeCost|discount)$/.test(k)));
}

function Card({ title, children, error }: { title: string; children: React.ReactNode; error?: string }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4 lg:p-6">
      <h2 className="mb-5 text-[16px] text-ink">{title}</h2>
      {error ? <p className="-mt-3 mb-4 text-[12px] text-danger">{error}</p> : null}
      {children}
    </section>
  );
}

function Grid({ children, cols = "lg:grid-cols-3" }: { children: React.ReactNode; cols?: string }) {
  return <div className={`grid gap-4 sm:grid-cols-2 ${cols}`}>{children}</div>;
}

function Field({ label, name, error, required, hint, children }: { label: string; name: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={name} className="text-[12px] font-semibold text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
        {hint ? <span className="font-normal text-muted"> · {hint}</span> : null}
      </label>
      {children}
      {error ? <p id={`${name}-error`} className="text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
