import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { PageIntro } from "@/components/ui/page-intro";
import { requirePermission } from "@/server/auth/permissions";
import { getLocationGroups, getPhoneCodes } from "@/server/reference-data";
import { getReservation } from "@/server/reservations/service";
import { updateReservationAction } from "../../actions";
import { reservationToFormValues } from "../../form-values";

export const metadata: Metadata = { title: "Edit reservation" };

// P1-RES-08: edit every field, including only the arrival or only the departure leg.
export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("reservations.edit");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [reservation, locationGroups, phoneCodes] = await Promise.all([getReservation(id), getLocationGroups(), getPhoneCodes()]);
  if (!reservation) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageIntro eyebrow={`RESERVATION ${reservation.reference}`} title="Edit reservation" description="Changes are saved to the audit log." />
      <ReservationForm
        action={updateReservationAction.bind(null, id)}
        initial={reservationToFormValues(reservation)}
        locationGroups={locationGroups}
        phoneCodes={phoneCodes}
        submitLabel="Save changes"
        cancelHref={`/reservations/${id}`}
        confirmSave={{
          title: "Save changes?",
          message: `The changes to reservation ${reservation.reference} will be saved and recorded in its history.`,
          confirmLabel: "Save changes",
        }}
      />
    </div>
  );
}
