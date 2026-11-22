// Creates fictional sample reservations for local testing (no real customer data).
// Usage: npm run db:seed-sample -- [--count=60] [--clear]
//   --clear  remove previous sample bookings first (emails ending in @sample.t2t.test)
// Bookings go through the normal service, so they get references, transfers and audit entries.
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "../src/server/db/client";
import { locationTypes, locations, reservations, users, SITES } from "../src/server/db/schema";
import type { AdminReservationInput } from "../src/server/reservations/input";
import { createReservation } from "../src/server/reservations/service";

const FIRST = ["Emma", "Lucas", "Sofia", "Noah", "Olivia", "Mateo", "Amelia", "Leo", "Chloe", "Hugo", "Isabella", "Liam", "Mia", "Ethan", "Giulia", "Pablo", "Hannah", "Oscar", "Ava", "Louis"];
const LAST = ["Martin", "Garcia", "Rossi", "Smith", "Dubois", "Muller", "Johnson", "Lopez", "Bernard", "Brown", "Fernandez", "Moreau", "Wilson", "Ricci", "Taylor", "Lefebvre"];
const CITIES = ["London", "Madrid", "Rome", "Berlin", "New York", "Dublin", "Lisbon", "Amsterdam", "Barcelona", "Milan"];
const AIRLINES = ["AF", "BA", "IB", "AZ", "LH", "EI", "TP", "KL", "VY", "U2"];
const SITE_WEIGHTS: Array<[(typeof SITES)[number], number]> = [["T2", 55], ["PAP", 25], ["T2ES", 8], ["T2IT", 4], ["PD", 4], ["T2UK", 2], ["T2FR", 2]];
const DOMAIN = "sample.t2t.test";

// Deterministic pseudo-random numbers, so every run produces the same sample set.
let seed = 20261122;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const weighted = <T>(items: Array<[T, number]>) => {
  let r = rand() * items.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of items) if ((r -= w) < 0) return v;
  return items[0][0];
};

/** Paris wall-clock "YYYY-MM-DD HH:MM" `days` from today, rounded to 5 minutes. */
function localTime(days: number, hour: number, minute: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
  return `${ymd} ${String(hour).padStart(2, "0")}:${String(minute - (minute % 5)).padStart(2, "0")}`;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  const total = Number(args.count ?? 60);

  if (args.clear === "true") {
    const [res] = await db.delete(reservations).where(like(reservations.email, `%@${DOMAIN}`));
    console.log(`Removed ${res.affectedRows} previous sample bookings.`);
  }

  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.username, process.env.SEED_ADMIN_USERNAME ?? "admin"));
  if (!admin) throw new Error("Run npm run db:seed first (no admin user).");

  const all = await db
    .select({ id: locations.id, type: locationTypes.name })
    .from(locations)
    .innerJoin(locationTypes, eq(locationTypes.id, locations.locationTypeId))
    .where(eq(locations.isActive, true));
  const airports = all.filter((l) => l.type === "Paris Airports").map((l) => l.id);
  const others = all.filter((l) => l.type !== "Paris Airports").map((l) => l.id);
  if (!airports.length || !others.length) throw new Error("Import locations first: npm run db:import-reference -- <dump>");

  const actor = { userId: admin.id, apiClientId: null, meta: { ip: "127.0.0.1", userAgent: "seed-sample-reservations" } };
  const created: number[] = [];

  for (let i = 0; i < total; i++) {
    const tripType = weighted<AdminReservationInput["tripType"]>([["arrival", 45], ["arrival_departure", 30], ["departure", 20], ["single", 5]]);
    const day = between(-20, 40); // journeys from 3 weeks ago to 6 weeks ahead
    const airport = pick(airports);
    const place = pick(others);
    const business = rand() < 0.12;
    const night = (h: number) => (h < 6 || h >= 22 ? 10 : 0);
    const first = pick(FIRST);
    const last = pick(LAST);

    const arrHour = between(5, 23);
    const depHour = between(4, 20);
    const input: AdminReservationInput = {
      site: weighted(SITE_WEIGHTS),
      tripType,
      status: day < 0 ? (rand() < 0.85 ? "confirmed" : "cancelled") : rand() < 0.55 ? "confirmed" : "pending",
      title: pick(["Mr", "Mrs", "Ms", null] as const),
      firstName: first,
      lastName: last,
      email: `${first}.${last}.${i}@${DOMAIN}`.toLowerCase(),
      phoneCode: pick(["+33", "+44", "+34", "+39", "+49", "+1"]),
      phone: `6${between(10000000, 99999999)}`,
      adults: between(1, 5),
      children: rand() < 0.4 ? between(1, 3) : 0,
      babies: rand() < 0.1 ? 1 : 0,
      luggageSmall: between(0, 3),
      luggageLarge: between(1, 4),
      luggageXl: rand() < 0.15 ? 1 : 0,
      trolleys: rand() < 0.1 ? 1 : 0,
      vehicleClass: business ? "business" : "economy",
      upgradeCost: business ? pick([20, 30, 40]) : 0,
      voucherCode: rand() < 0.08 ? "WELCOME10" : null,
      discount: 0,
      paymentMethod: pick(["cash", "card", "online", null] as const),
      paymentStatus: rand() < 0.35 ? "paid" : "unpaid",
      clientComments: rand() < 0.25 ? pick(["Child seat please", "We will be at exit 8", "Late flight, please wait", "Wheelchair needed"]) : null,
      specialNotes: null,
      utmSource: rand() < 0.3 ? "Google" : null,
      utmMedium: null,
    };
    if (input.voucherCode) input.discount = 10;

    const arrival = {
      pickupLocationId: airport, pickupAddress: null, dropLocationId: place, dropAddress: rand() < 0.3 ? `${between(1, 120)} Rue de la Paix` : null,
      pickupAt: null, flightNo: `${pick(AIRLINES)}${between(100, 9999)}`, flightCity: pick(CITIES), flightAt: localTime(day, arrHour, between(0, 59)),
      rate: between(65, 140), nightCharge: night(arrHour), vatRate: 10,
    };
    const departure = {
      pickupLocationId: place, pickupAddress: null, dropLocationId: airport, dropAddress: null,
      pickupAt: localTime(day + between(2, 10), depHour, between(0, 59)), flightNo: `${pick(AIRLINES)}${between(100, 9999)}`, flightCity: pick(CITIES),
      flightAt: localTime(day + between(2, 10), Math.min(23, depHour + 3), 0), rate: between(65, 140), nightCharge: night(depHour), vatRate: 10,
    };
    if (tripType === "arrival") input.arrival = arrival;
    if (tripType === "arrival_departure") Object.assign(input, { arrival, departure: { ...departure, pickupAt: localTime(day + 5, depHour, 0) } });
    if (tripType === "departure") input.departure = departure;
    if (tripType === "single") input.single = { ...arrival, flightNo: null, flightCity: null, flightAt: null, pickupAt: localTime(day, between(8, 20), 0) };

    const { id } = await createReservation(input, actor);
    created.push(id);
  }

  // Spread creation dates over the last 60 days so "created date" search and the list order look realistic.
  for (const id of created) {
    const createdAt = new Date(Date.now() - between(0, 60) * 86_400_000 - between(0, 86_399) * 1000);
    await db.update(reservations).set({ createdAt, updatedAt: createdAt }).where(eq(reservations.id, id));
  }
  // A few soft-deleted ones, to test "Show deleted" and Restore.
  const toDelete = created.filter((_, i) => i % 15 === 7);
  if (toDelete.length) await db.update(reservations).set({ deletedAt: new Date() }).where(and(inArray(reservations.id, toDelete)));

  console.log(`Created ${created.length} sample reservations (${toDelete.length} soft-deleted). Emails end in @${DOMAIN}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
