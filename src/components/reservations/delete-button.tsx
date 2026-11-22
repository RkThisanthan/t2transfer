"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";

/** The visible button only opens the confirm box; the form is submitted after "confirm". */
function Trigger({ label, variant, icon, onClick }: { label: string; variant: "danger" | "secondary"; icon?: "trash-2"; onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type="button" disabled={pending} onClick={onClick} className={buttonClass(variant, "w-full lg:w-auto")}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {pending ? "Please wait…" : label}
    </button>
  );
}

function ConfirmedActionForm({
  action,
  label,
  variant,
  icon,
  dialog,
}: {
  action: () => Promise<void>;
  label: string;
  variant: "danger" | "secondary";
  icon?: "trash-2";
  dialog: { title: string; message: React.ReactNode; confirmLabel: string; tone: "primary" | "danger" };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <form ref={formRef} action={action} className="contents">
      <Trigger label={label} variant={variant} icon={icon} onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        {...dialog}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}

/** Soft delete (P1-RES-09) with a confirmation step. */
export function DeleteReservationButton({ action, reference }: { action: () => Promise<void>; reference: string }) {
  return (
    <ConfirmedActionForm
      action={action}
      label="Delete"
      variant="danger"
      icon="trash-2"
      dialog={{
        title: "Delete this reservation?",
        message: (
          <>
            Reservation <span className="font-semibold text-ink">{reference}</span> will be removed from the list. You can restore it later
            with &quot;Show deleted&quot;.
          </>
        ),
        confirmLabel: "Delete reservation",
        tone: "danger",
      }}
    />
  );
}

export function RestoreReservationButton({ action }: { action: () => Promise<void> }) {
  return (
    <ConfirmedActionForm
      action={action}
      label="Restore"
      variant="secondary"
      dialog={{
        title: "Restore this reservation?",
        message: "It will appear in the reservation list again and can be edited.",
        confirmLabel: "Restore",
        tone: "primary",
      }}
    />
  );
}
