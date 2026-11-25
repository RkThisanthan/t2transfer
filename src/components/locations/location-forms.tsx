"use client";

import { useActionState, useEffect, useRef } from "react";
import type { SimpleFormState } from "@/app/(app)/locations/actions";
import { buttonClass } from "@/components/ui/button";

type Action = (prev: SimpleFormState, formData: FormData) => Promise<SimpleFormState>;

/** Cancel closes the modal; a successful save calls onDone (close + refresh the list). */
export type ModalHandlers = { onCancel: () => void; onDone: (notice?: string) => void };

const control = "h-[46px] w-full rounded-lg border bg-white px-3 text-[14px] text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-[12px] font-semibold text-ink">
        {label}
        {hint ? <span className="font-normal text-muted"> · {hint}</span> : null}
      </label>
      {children}
      {error ? <p id={`${id}-error`} className="text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

// Error message, fields, and Cancel / Save. The forms only live in modals (see location-modals.tsx).
function Shell({
  state,
  children,
  submitLabel,
  pending,
  modal,
}: {
  state: SimpleFormState;
  children: React.ReactNode;
  submitLabel: string;
  pending: boolean;
  modal: ModalHandlers;
}) {
  // Close the modal once the server confirms the save (once per result).
  const handled = useRef<SimpleFormState | null>(null);
  useEffect(() => {
    if (state.done && handled.current !== state) {
      handled.current = state;
      modal.onDone(state.notice);
    }
  }, [state, modal]);

  return (
    <>
      {state.formError ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">{state.formError}</p> : null}
      {children}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={modal.onCancel} className={buttonClass("secondary")}>Cancel</button>
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm:min-w-40")}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </>
  );
}

const inputProps = (name: string, values: Record<string, string>, errors: Record<string, string>) => ({
  id: name,
  name,
  defaultValue: values[name] ?? "",
  "aria-invalid": errors[name] ? true : undefined,
  "aria-describedby": errors[name] ? `${name}-error` : undefined,
  className: `${control} ${errors[name] ? "border-danger" : "border-line"}`,
});

/** P1-LOC-02: name, type, sort order. */
export function LocationForm({
  action,
  initial,
  types,
  submitLabel,
  modal,
}: {
  action: Action;
  initial: Record<string, string>;
  types: { id: number; name: string }[];
  submitLabel: string;
  modal: ModalHandlers;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <Shell state={state} submitLabel={submitLabel} pending={pending} modal={modal}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" error={errors.name}>
            <input {...inputProps("name", values, errors)} placeholder="e.g. Orly Airport" autoComplete="off" autoFocus />
          </Field>
          <Field id="locationTypeId" label="Type" error={errors.locationTypeId}>
            <select {...inputProps("locationTypeId", values, errors)}>
              <option value="">Choose a type</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field id="sortOrder" label="Sort order" hint="lower shows first" error={errors.sortOrder}>
            <input {...inputProps("sortOrder", values, errors)} type="number" min="0" step="1" inputMode="numeric" />
          </Field>
          {/* No status field: new locations are created active, and the list's Activate / Deactivate buttons change it. */}
        </div>
      </Shell>
    </form>
  );
}

/** P1-LOC-01: name and sort order. */
export function LocationTypeForm({ action, initial, submitLabel, modal }: { action: Action; initial: Record<string, string>; submitLabel: string; modal: ModalHandlers }) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <Shell state={state} submitLabel={submitLabel} pending={pending} modal={modal}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" error={errors.name}>
            <input {...inputProps("name", values, errors)} placeholder="e.g. Paris Airports" autoComplete="off" autoFocus />
          </Field>
          <Field id="sortOrder" label="Sort order" hint="lower shows first" error={errors.sortOrder}>
            <input {...inputProps("sortOrder", values, errors)} type="number" min="0" step="1" inputMode="numeric" />
          </Field>
        </div>
      </Shell>
    </form>
  );
}
