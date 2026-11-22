import type { FormValues } from "@/components/reservations/reservation-form";
import { toInputDateTime } from "@/lib/format";
import type { ReservationWithLegs } from "@/server/reservations/service";

export const NEW_RESERVATION_VALUES: FormValues = {
  site: "T2",
  tripType: "arrival",
  status: "pending",
  vehicleClass: "economy",
  adults: "1",
  children: "0",
  babies: "0",
  trolleys: "0",
  luggageSmall: "0",
  luggageLarge: "0",
  luggageXl: "0",
  upgradeCost: "0",
  discount: "0",
  paymentStatus: "unpaid",
  phoneCode: "+33",
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function reservationToFormValues(r: ReservationWithLegs): FormValues {
  const values: FormValues = {
    site: r.site, tripType: r.tripType, status: r.status, vehicleClass: r.vehicleClass,
    title: s(r.title), firstName: r.firstName, lastName: r.lastName, email: r.email, phoneCode: s(r.phoneCode), phone: s(r.phone),
    adults: s(r.adults), children: s(r.children), babies: s(r.babies), trolleys: s(r.trolleys),
    luggageSmall: s(r.luggageSmall), luggageLarge: s(r.luggageLarge), luggageXl: s(r.luggageXl),
    upgradeCost: s(r.upgradeCost), voucherCode: s(r.voucherCode), discount: s(r.discount),
    paymentMethod: s(r.paymentMethod), paymentStatus: r.paymentStatus,
    clientComments: s(r.clientComments), specialNotes: s(r.specialNotes), utmSource: s(r.utmSource), utmMedium: s(r.utmMedium),
  };
  for (const leg of r.legs) {
    const k = leg.kind;
    Object.assign(values, {
      [`${k}.pickupLocationId`]: s(leg.pickupLocationId), [`${k}.pickupAddress`]: s(leg.pickupAddress),
      [`${k}.dropLocationId`]: s(leg.dropLocationId), [`${k}.dropAddress`]: s(leg.dropAddress),
      [`${k}.pickupAt`]: toInputDateTime(leg.pickupAt), [`${k}.flightAt`]: toInputDateTime(leg.flightAt),
      [`${k}.flightNo`]: s(leg.flightNo), [`${k}.flightCity`]: s(leg.flightCity),
      [`${k}.rate`]: s(leg.rate), [`${k}.nightCharge`]: s(leg.nightCharge), [`${k}.vatRate`]: s(Number(leg.vatRate)),
    });
  }
  return values;
}
