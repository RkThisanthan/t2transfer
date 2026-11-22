// Pure mapping from one legacy `reservations` row to the new reservation + legs.
// Rules: Phase 1 spec, Section 5.4. No database access here, so the rules can be unit-tested.
import { SITES } from "@/server/db/schema";

export type LegacyRow = {
  id: number;
  reference: string | null;
  name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_code: string | null;
  email: string | null;
  comment: string | null;
  pickup_location: number | null;
  drop_location: number | null;
  pickup_time: string | null;
  arrival_flight_date: string | null;
  arrival_flight_from: string | null;
  arrival_flight_no: string | null;
  departure_pickup_location: number | null;
  departure_drop_location: number | null;
  departure_pickup_time: string | null;
  departure_flight_date: string | null;
  departure_flight_to: string | null;
  departure_flight_no: string | null;
  adults: number | null;
  children: number | null;
  babies: number | null;
  amount: number | null;
  payment_method: string | null;
  status: number | null;
  special_notes: string | null;
  created_date: string | null;
  removed: number | null;
  removed_on: string | null;
  name_title: number | null;
  arrival_pickup_address: string | null;
  arrival_drop_address: string | null;
  departure_pickup_address: string | null;
  departure_drop_address: string | null;
  arrival_rate: number | null;
  departure_rate: number | null;
  arrival_night_charge: number | null;
  departure_night_charge: number | null;
  total_cost: number | null;
  shown_forms: number | null;
  site_name: string | null;
  payment_status: number | null;
  atva: number | null;
  dtva: number | null;
  s_lug: number | null;
  x_lug: number | null;
  trollley: number | null;
  v_code: string | null;
  vtype: number | null;
  uvtype: number | null;
  utm_source: string | null;
  utm_medium: string | null;
};

type Site = (typeof SITES)[number];
type TripType = "arrival" | "departure" | "arrival_departure" | "single";

export type MappedLeg = {
  kind: "arrival" | "departure" | "single";
  pickupLegacyLocation: number | null;
  pickupAddress: string | null;
  dropLegacyLocation: number | null;
  dropAddress: string | null;
  pickupAt: string | null;
  flightNo: string | null;
  flightCity: string | null;
  flightAt: string | null;
  rate: number;
  nightCharge: number;
  vatRate: number;
};

export type MappedReservation = {
  legacyId: number;
  reference: string | null; // null = generate one
  site: Site;
  tripType: TripType;
  status: "pending" | "confirmed";
  title: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneCode: string | null;
  phone: string | null;
  adults: number;
  children: number;
  babies: number;
  luggageSmall: number;
  luggageXl: number;
  trolleys: number;
  vehicleClass: "economy" | "business";
  upgradeCost: number;
  voucherCode: string | null;
  discount: number;
  total: number;
  paymentMethod: "cash" | "card" | "online" | "bank" | null;
  paymentStatus: "unpaid" | "paid";
  clientComments: string | null;
  specialNotes: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  createdAtParis: string | null; // legacy wall-clock time, converted to UTC by the caller
  deletedAtParis: string | null;
  legs: MappedLeg[];
};

export type MapResult =
  | { kind: "ok"; reservation: MappedReservation; warnings: string[] }
  | { kind: "skip"; reason: "incomplete_no_dates" };

/** Legacy "empty" dates: NULL, 0000-00-00, 1970-01-01, 1969-12-31 19:00 (as the old daily plan treats them). */
export function validDate(v: string | null | undefined): string | null {
  if (!v) return null;
  return v >= "2000-01-01" ? v.slice(0, 19) : null;
}

const text = (v: string | null | undefined, max: number): string | null => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
};
const int = (v: number | null | undefined) => (v && v > 0 ? Math.round(v) : 0);
const money = (v: number | null | undefined) => (v && v > 0 ? Math.round(v * 100) / 100 : 0);

const TITLES: Record<number, string> = { 1: "Mr", 2: "Mrs", 3: "Ms" }; // to confirm with the client
const PAYMENT: Record<string, MappedReservation["paymentMethod"]> = { cash: "cash", card: "card", online: "online", bank: "bank" };

export function mapLegacyReservation(row: LegacyRow, opts: { includeIncomplete: boolean }): MapResult {
  const warnings: string[] = [];
  const arrivalAt = validDate(row.arrival_flight_date);
  const departureAt = validDate(row.departure_pickup_time);
  const pickupTime = validDate(row.pickup_time);
  const isSingleForm = row.shown_forms === 3;

  // Trip type from which dates are filled (shown_forms is 0 on most older rows).
  let tripType: TripType;
  if (isSingleForm) tripType = "single";
  else if (arrivalAt && departureAt) tripType = "arrival_departure";
  else if (arrivalAt) tripType = "arrival";
  else if (departureAt) tripType = "departure";
  else if (pickupTime) tripType = "single";
  else {
    if (!opts.includeIncomplete) return { kind: "skip", reason: "incomplete_no_dates" };
    tripType = "arrival";
    warnings.push("no_journey_dates");
  }

  const outbound = (kind: "arrival" | "single", at: string | null): MappedLeg => ({
    kind,
    pickupLegacyLocation: row.pickup_location || null,
    pickupAddress: text(row.arrival_pickup_address, 1000),
    dropLegacyLocation: row.drop_location || null,
    dropAddress: text(row.arrival_drop_address, 1000),
    pickupAt: kind === "single" ? at : null,
    flightNo: kind === "arrival" ? text(row.arrival_flight_no, 50) : null,
    flightCity: kind === "arrival" ? text(row.arrival_flight_from, 100) : null,
    flightAt: kind === "arrival" ? at : null,
    rate: money(row.arrival_rate),
    nightCharge: money(row.arrival_night_charge),
    vatRate: money(row.atva),
  });
  const departure = (): MappedLeg => ({
    kind: "departure",
    pickupLegacyLocation: row.departure_pickup_location || null,
    pickupAddress: text(row.departure_pickup_address, 1000),
    dropLegacyLocation: row.departure_drop_location || null,
    dropAddress: text(row.departure_drop_address, 1000),
    pickupAt: departureAt,
    flightNo: text(row.departure_flight_no, 50),
    flightCity: text(row.departure_flight_to, 100),
    flightAt: validDate(row.departure_flight_date),
    rate: money(row.departure_rate),
    nightCharge: money(row.departure_night_charge),
    vatRate: money(row.dtva),
  });

  const legs: MappedLeg[] = [];
  if (tripType === "arrival" || tripType === "arrival_departure") legs.push(outbound("arrival", arrivalAt));
  if (tripType === "departure" || tripType === "arrival_departure") legs.push(departure());
  if (tripType === "single") legs.push(outbound("single", isSingleForm ? arrivalAt ?? pickupTime : pickupTime));

  // Site: empty means T2 (as the old panel shows it).
  const siteRaw = (row.site_name ?? "").trim().toUpperCase();
  let site: Site = "T2";
  if (siteRaw && (SITES as readonly string[]).includes(siteRaw)) site = siteRaw as Site;
  else if (siteRaw) warnings.push(`unknown_site:${siteRaw}`);

  // Money: keep the legacy total (total_cost until 2020, only `amount` from 2021 on).
  const upgradeCost = money(row.vtype);
  const total = money(row.total_cost) || money(row.amount);
  // From 2021 the legacy system stores no per-transfer rates, only the total. Put that price on the first
  // transfer, so totals stay correct when the booking is edited in the new admin (total = rates + upgrade − discount).
  if (total > 0 && legs.length && legs.every((l) => l.rate + l.nightCharge === 0)) {
    legs[0].rate = Math.max(0, Math.round((total - upgradeCost) * 100) / 100);
    warnings.push("price_on_first_leg");
  }
  // The discount is whatever makes rates + upgrade − discount = total.
  const legsSum = legs.reduce((s, l) => s + l.rate + l.nightCharge, 0);
  const gap = Math.round((legsSum + upgradeCost - total) * 100) / 100;
  const discount = total > 0 && gap > 0 ? gap : 0;
  if (total > 0 && gap < 0) warnings.push("total_above_rates");

  const email = (row.email ?? "").trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) warnings.push("invalid_email");

  const method = (row.payment_method ?? "").trim().toLowerCase();

  return {
    kind: "ok",
    warnings,
    reservation: {
      legacyId: row.id,
      reference: text(row.reference, 40),
      site,
      tripType,
      status: row.status === 1 ? "confirmed" : "pending",
      title: TITLES[row.name_title ?? 0] ?? null,
      firstName: text(row.name, 150) ?? "",
      lastName: text(row.last_name, 150) ?? "",
      email: email.slice(0, 190),
      phoneCode: text(row.phone_code, 20),
      phone: text(row.phone, 50),
      adults: Math.max(1, int(row.adults)),
      children: int(row.children),
      babies: int(row.babies),
      luggageSmall: int(row.s_lug),
      luggageXl: int(row.x_lug),
      trolleys: int(row.trollley),
      vehicleClass: row.uvtype === 1 ? "business" : "economy",
      upgradeCost,
      voucherCode: text(row.v_code, 60),
      discount,
      total,
      paymentMethod: PAYMENT[method] ?? null,
      paymentStatus: row.payment_status === 1 ? "paid" : "unpaid",
      clientComments: text(row.comment, 5000),
      specialNotes: text(row.special_notes, 5000),
      utmSource: text(row.utm_source, 100),
      utmMedium: text(row.utm_medium, 100),
      createdAtParis: validDate(row.created_date),
      deletedAtParis: row.removed === 1 ? validDate(row.removed_on) ?? validDate(row.created_date) ?? "2000-01-01 00:00:00" : null,
      legs,
    },
  };
}

/** Converts a Paris wall-clock time ("2026-10-24 11:27:00") to a UTC Date. */
export function parisToUtc(local: string): Date {
  const asUtc = new Date(`${local.replace(" ", "T")}Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
    .formatToParts(asUtc)
    .find((p) => p.type === "timeZoneName")!.value;
  const m = parts.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetMin = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(asUtc.getTime() - offsetMin * 60000);
}
