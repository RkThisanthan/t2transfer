import type { InputHTMLAttributes } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string; label: string };

// 18px checkbox, 4px radius, #dfe6ed border; checked state uses the brand blue.
export function Checkbox({ id, label, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center self-start gap-[9px] text-[13px] text-ink">
      <span className="relative inline-flex size-[18px] shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer size-[18px] cursor-pointer appearance-none rounded-[4px] border border-line bg-white transition-colors checked:border-brand checked:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          {...props}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 18 18"
          className="pointer-events-none absolute inset-0 hidden size-[18px] peer-checked:block"
          fill="none"
        >
          <path d="M5 9.5l2.5 2.5L13 6.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </label>
  );
}
