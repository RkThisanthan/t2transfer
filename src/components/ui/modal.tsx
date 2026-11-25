"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the box, e.g. "max-w-xl". */
  width?: string;
};

/**
 * General-purpose modal on the native <dialog>: centred, focus trapped, Esc / backdrop click close it.
 * The content is only rendered while open, so forms start fresh every time.
 */
export function Modal({ open, title, description, onClose, children, width = "max-w-xl" }: Props) {
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
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
      // Same positioning rules as ConfirmDialog: centred wherever it sits in the page, own text styles.
      className={`fixed inset-0 m-auto h-fit max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] ${width} overflow-y-auto rounded-xl border border-line bg-white p-0 text-left font-normal whitespace-normal text-ink shadow-xl backdrop:bg-navy-900/40`}
    >
      {open ? (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 id="modal-title" className="text-[18px] font-bold">{title}</h2>
              {description ? <div className="text-[13px] leading-[1.5] text-muted">{description}</div> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-[20px] text-muted hover:bg-canvas hover:text-ink"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
