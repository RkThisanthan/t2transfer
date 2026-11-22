import type { Metadata } from "next";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { PageIntro } from "@/components/ui/page-intro";
import { requirePermission } from "@/server/auth/permissions";
import { getLocationGroups, getPhoneCodes } from "@/server/reference-data";
import { createReservationAction } from "../actions";
import { NEW_RESERVATION_VALUES } from "../form-values";

export const metadata: Metadata = { title: "New reservation" };

// P1-RES-04: staff create a reservation by hand (phone or email bookings).
export default async function NewReservationPage() {
  await requirePermission("reservations.create");
  const [locationGroups, phoneCodes] = await Promise.all([getLocationGroups(), getPhoneCodes()]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageIntro eyebrow="TRANSFER MANAGEMENT" title="New reservation" description="A reference number is created when you save." />
      <ReservationForm
        action={createReservationAction}
        initial={NEW_RESERVATION_VALUES}
        locationGroups={locationGroups}
        phoneCodes={phoneCodes}
        submitLabel="Create reservation"
        cancelHref="/reservations"
      />
    </div>
  );
}
