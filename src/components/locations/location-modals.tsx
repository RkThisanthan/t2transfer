"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SimpleFormState } from "@/app/(app)/locations/actions";
import { buttonClass } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { LocationForm, LocationTypeForm } from "./location-forms";

type Action = (prev: SimpleFormState, formData: FormData) => Promise<SimpleFormState>;

type Common = {
  /** Button that opens the modal */
  label: string;
  variant?: "primary" | "secondary";
  icon?: IconName;
  buttonClassName?: string;
  /** Modal */
  title: string;
  description?: React.ReactNode;
  action: Action;
  initial: Record<string, string>;
  submitLabel: string;
};

/** Where to go after saving, so the list re-renders with the success message. */
function useAfterSave(base: "/locations" | "/locations?tab=types") {
  const router = useRouter();
  return (notice?: string) => {
    const sep = base.includes("?") ? "&" : "?";
    router.replace(notice ? `${base}${sep}notice=${notice}` : base, { scroll: false });
  };
}

function Trigger({ label, variant = "secondary", icon, className, onClick }: { label: string; variant?: "primary" | "secondary"; icon?: IconName; className?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={buttonClass(variant, className)}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {label}
    </button>
  );
}

/** "New location" / "Edit" button that opens the location form in a modal (P1-LOC-02). */
export function LocationModalButton({ types, ...p }: Common & { types: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const afterSave = useAfterSave("/locations");
  return (
    <>
      <Trigger label={p.label} variant={p.variant} icon={p.icon} className={p.buttonClassName} onClick={() => setOpen(true)} />
      <Modal open={open} title={p.title} description={p.description} onClose={() => setOpen(false)}>
        <LocationForm
          action={p.action}
          initial={p.initial}
          types={types}
          submitLabel={p.submitLabel}
          modal={{ onCancel: () => setOpen(false), onDone: (notice) => { setOpen(false); afterSave(notice); } }}
        />
      </Modal>
    </>
  );
}

/** "New location type" / "Edit" button that opens the type form in a modal (P1-LOC-01). */
export function LocationTypeModalButton(p: Common) {
  const [open, setOpen] = useState(false);
  const afterSave = useAfterSave("/locations?tab=types");
  return (
    <>
      <Trigger label={p.label} variant={p.variant} icon={p.icon} className={p.buttonClassName} onClick={() => setOpen(true)} />
      <Modal open={open} title={p.title} description={p.description} onClose={() => setOpen(false)}>
        <LocationTypeForm
          action={p.action}
          initial={p.initial}
          submitLabel={p.submitLabel}
          modal={{ onCancel: () => setOpen(false), onDone: (notice) => { setOpen(false); afterSave(notice); } }}
        />
      </Modal>
    </>
  );
}
