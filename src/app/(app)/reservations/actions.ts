"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/server/auth/permissions";
import { getRequestMeta } from "@/server/auth/request-meta";
import { adminReservationSchema } from "@/server/reservations/input";
import {
  createReservation,
  restoreReservation,
  softDeleteReservation,
  updateReservation,
} from "@/server/reservations/service";

export type ReservationFormState = {
  errors?: Record<string, string>;
  formError?: string;
  values?: Record<string, string>;
};

/** Turns flat form fields ("arrival.pickupAt") into the nested object the schema expects. */
function formToObject(formData: FormData) {
  const out: Record<string, unknown> = {};
  const values: Record<string, string> = {};
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith("$")) continue; // React's internal action fields
    const value = typeof raw === "string" ? raw : "";
    values[key] = value;
    const [head, tail] = key.split(".");
    if (tail) {
      const leg = (out[head] ??= {}) as Record<string, unknown>;
      if (value !== "") leg[tail] = value;
    } else if (value !== "") {
      out[head] = value;
    }
  }
  return { out, values };
}

function errorMap(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    map[key] ??= issue.message;
  }
  return map;
}

async function actor(userId: number) {
  return { userId, apiClientId: null, meta: await getRequestMeta() };
}

export async function createReservationAction(_prev: ReservationFormState, formData: FormData): Promise<ReservationFormState> {
  const user = await requirePermission("reservations.create");
  const { out, values } = formToObject(formData);
  const parsed = adminReservationSchema.safeParse(out);
  if (!parsed.success) return { errors: errorMap(parsed.error), values, formError: "Check the highlighted fields." };

  const { id } = await createReservation(parsed.data, await actor(user.id));
  revalidatePath("/reservations");
  redirect(`/reservations/${id}?created=1`);
}

export async function updateReservationAction(id: number, _prev: ReservationFormState, formData: FormData): Promise<ReservationFormState> {
  const user = await requirePermission("reservations.edit");
  const { out, values } = formToObject(formData);
  const parsed = adminReservationSchema.safeParse(out);
  if (!parsed.success) return { errors: errorMap(parsed.error), values, formError: "Check the highlighted fields." };

  const ok = await updateReservation(id, parsed.data, await actor(user.id));
  if (!ok) return { values, formError: "This reservation no longer exists or was deleted." };
  revalidatePath("/reservations");
  redirect(`/reservations/${id}?saved=1`);
}

export async function deleteReservationAction(id: number) {
  const user = await requirePermission("reservations.delete");
  await softDeleteReservation(id, await actor(user.id));
  revalidatePath("/reservations");
  redirect("/reservations?deletedOk=1");
}

export async function restoreReservationAction(id: number) {
  const user = await requirePermission("reservations.delete");
  await restoreReservation(id, await actor(user.id));
  revalidatePath("/reservations");
  redirect(`/reservations/${id}?restored=1`);
}
