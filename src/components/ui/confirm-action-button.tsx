"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { Icon, type IconName } from "./icon";

type Props = {
  action: () => Promise<void>;
  label: string;
  variant?: "secondary" | "danger" | "primary";
  icon?: IconName;
  className?: string;
  confirm: { title: string; message: React.ReactNode; confirmLabel: string; tone?: "primary" | "danger" };
};

function Trigger({ label, variant, icon, className, onClick }: Omit<Props, "action" | "confirm"> & { onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type="button" disabled={pending} onClick={onClick} className={buttonClass(variant ?? "secondary", className)}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {pending ? "Please wait…" : label}
    </button>
  );
}

/** A button that runs a server action only after the user confirms in a dialog. */
export function ConfirmActionButton({ action, label, variant, icon, className, confirm }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <form ref={formRef} action={action} className="contents">
      <Trigger label={label} variant={variant} icon={icon} className={className} onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        tone={confirm.tone}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
