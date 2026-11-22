// Display helpers. All times are shown in Paris time, e.g. "24 Oct 2026 · 11:27".

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** For UTC instants (created_at, updated_at): converted to Paris time. */
export function formatInstant(date: Date | null | undefined): string {
  if (!date) return "—";
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")} ${g("month")} ${g("year")} · ${g("hour")}:${g("minute")}`;
}

/** For journey times already stored as Paris wall-clock strings ("2026-10-25 17:45:00"). */
export function formatLocal(value: string | null | undefined): string {
  if (!value) return "—";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return value;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]} · ${m[4]}:${m[5]}`;
}

/** "2026-10-25 17:45:00" → "2026-10-25T17:45" for datetime-local inputs. */
export const toInputDateTime = (value: string | null | undefined) => (value ? value.slice(0, 16).replace(" ", "T") : "");

export function formatMoney(amount: number | string, currency = "EUR"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(amount));
}

// Legacy site codes (site_name). Names marked "to confirm" are guesses from the data.
export const SITE_NAMES = {
  T2: "T2 Transfer",
  T2ES: "T2 Traslados (Spanish)",
  T2IT: "T2 Transfer Italian",
  T2UK: "T2 Transfer UK",
  T2FR: "T2 Transfer French",
  IT: "IT (to confirm)",
  TIT2: "TIT2 (to confirm)",
  PAP: "Paris Airport Pickup",
  PD: "PD Shuttle",
  "PD-SP": "PD Shuttle Spanish (to confirm)",
} as const;
/** The list shows the short code itself, as the old panel and the Figma design do ("T2"). */
export const SITE_LABELS = Object.fromEntries(Object.keys(SITE_NAMES).map((k) => [k, k])) as Record<keyof typeof SITE_NAMES, string>;
export const TRIP_LABELS = { arrival: "Arrival", departure: "Departure", arrival_departure: "Arrival + departure", single: "Single transfer" } as const;
export const VEHICLE_LABELS = { economy: "Economy", business: "Business" } as const;
export const PAYMENT_LABELS = { cash: "Cash", card: "Card", online: "Online", bank: "Bank" } as const;
