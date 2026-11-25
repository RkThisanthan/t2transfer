"use client";

import { useEffect, useRef } from "react";
import { buttonClass } from "./button";
import { Icon } from "./icon";

type Props = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Accessible confirmation box built on the native <dialog>: focus is trapped inside,
 * Esc and a click on the backdrop cancel, and the page behind cannot be used while it is open.
 */
export function ConfirmDialog({ open, title, message, confirmLabel, tone = "primary", onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel(); // click on the backdrop
      }}
      // Fixed + inset-0 + m-auto + h-fit keeps the box centred on screen wherever it sits in the page.
      // text-left/font-normal: it inherits text styles from where it is placed (e.g. a right-aligned table cell).
      className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md overflow-y-auto rounded-xl border border-line bg-white p-0 text-left text-ink font-normal whitespace-normal shadow-xl backdrop:bg-navy-900/40"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone === "danger" ? "bg-danger-soft" : "bg-brand-soft"}`}>
            <Icon name={tone === "danger" ? "trash-2" : "pencil"} size={18} />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 id="confirm-title" className="text-[17px] font-bold">{title}</h2>
            <div className="text-[14px] leading-[1.5] text-muted">{message}</div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={onCancel} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={tone === "danger" ? buttonClass("primary", "border-danger-ink bg-danger-ink hover:border-danger-ink hover:bg-danger-ink/90") : buttonClass("primary")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
