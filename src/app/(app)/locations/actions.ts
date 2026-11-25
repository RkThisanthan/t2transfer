"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/permissions";
import { getRequestMeta } from "@/server/auth/request-meta";
import {
  createLocation,
  createLocationType,
  deleteLocation,
  deleteLocationType,
  LocationError,
  locationInput,
  locationTypeInput,
  setLocationActive,
  updateLocation,
  updateLocationType,
} from "@/server/locations/service";

export type SimpleFormState = {
  errors?: Record<string, string>;
  formError?: string;
  values?: Record<string, string>;
  /** Save succeeded: the modal closes and the list shows `notice`. */
  done?: boolean;
  notice?: string;
};

const actor = async (userId: number) => ({ userId, apiClientId: null, meta: await getRequestMeta() });

function fields(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (!k.startsWith("$") && typeof v === "string") values[k] = v;
  return values;
}

function fail(err: unknown, values: Record<string, string>): SimpleFormState {
  if (err instanceof LocationError) {
    return err.field === "_" ? { formError: err.message, values } : { errors: { [err.field]: err.message }, values, formError: "Check the highlighted fields." };
  }
  throw err;
}

function refresh() {
  revalidatePath("/locations");
  revalidatePath("/reservations"); // location names appear in reservations and the booking form
}

// --- Locations ---------------------------------------------------------------

export async function saveLocationAction(id: number | null, _prev: SimpleFormState, formData: FormData): Promise<SimpleFormState> {
  const user = await requirePermission("locations.manage");
  const values = fields(formData);
  // The form has no status field: create = active, edit = status unchanged (see the service).
  const parsed = locationInput.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors, values, formError: "Check the highlighted fields." };
  }
  try {
    if (id) await updateLocation(id, parsed.data, await actor(user.id));
    else await createLocation(parsed.data, await actor(user.id));
  } catch (err) {
    return fail(err, values);
  }
  refresh();
  return { done: true, notice: id ? "saved" : "created" }; // the modal closes and shows the notice
}

export async function setLocationActiveAction(id: number, isActive: boolean) {
  const user = await requirePermission("locations.manage");
  await setLocationActive(id, isActive, await actor(user.id));
  refresh();
  redirect(`/locations?notice=${isActive ? "activated" : "deactivated"}`);
}

export async function deleteLocationAction(id: number) {
  const user = await requirePermission("locations.manage");
  try {
    await deleteLocation(id, await actor(user.id));
  } catch (err) {
    if (err instanceof LocationError) redirect(`/locations?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  refresh();
  redirect("/locations?notice=deleted");
}

// --- Location types ------------------------------------------------------------

export async function saveLocationTypeAction(id: number | null, _prev: SimpleFormState, formData: FormData): Promise<SimpleFormState> {
  const user = await requirePermission("locations.manage");
  const values = fields(formData);
  const parsed = locationTypeInput.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { errors, values, formError: "Check the highlighted fields." };
  }
  try {
    if (id) await updateLocationType(id, parsed.data, await actor(user.id));
    else await createLocationType(parsed.data, await actor(user.id));
  } catch (err) {
    return fail(err, values);
  }
  refresh();
  return { done: true, notice: id ? "type-saved" : "type-created" };
}

export async function deleteLocationTypeAction(id: number) {
  const user = await requirePermission("locations.manage");
  try {
    await deleteLocationType(id, await actor(user.id));
  } catch (err) {
    if (err instanceof LocationError) redirect(`/locations?tab=types&error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  refresh();
  redirect("/locations?tab=types&notice=type-deleted");
}
