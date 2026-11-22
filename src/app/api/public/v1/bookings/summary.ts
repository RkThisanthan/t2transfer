import type { ReservationWithLegs } from "@/server/reservations/service";

/** What the WordPress site may see about a booking (no staff notes, no internal ids). */
export function bookingSummary(r: ReservationWithLegs) {
  return {
    reference: r.reference,
    status: r.status,
    tripType: r.tripType,
    total: Number(r.total),
    currency: r.currency,
    customer: { title: r.title, firstName: r.firstName, lastName: r.lastName, email: r.email },
    legs: r.legs.map((l) => ({
      kind: l.kind,
      pickupLocationId: l.pickupLocationId,
      pickupAddress: l.pickupAddress,
      dropLocationId: l.dropLocationId,
      dropAddress: l.dropAddress,
      pickupAt: l.pickupAt,
      flightNo: l.flightNo,
      flightCity: l.flightCity,
      flightAt: l.flightAt,
    })),
    createdAt: r.createdAt.toISOString(),
  };
}
