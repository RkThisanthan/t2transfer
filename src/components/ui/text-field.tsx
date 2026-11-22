import type { InputHTMLAttributes, ReactNode } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  trailing?: ReactNode;
};

// Form field from Figma: 12px semibold label, 46px input, 8px radius, #dfe6ed border.
export function TextField({ id, label, error, trailing, className, ...inputProps }: TextFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="text-[12px] font-semibold text-ink">
        {label}
      </label>
      <div
        className={`flex h-[46px] w-full items-center gap-2.5 rounded-lg border bg-white px-3 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
          error ? "border-danger" : "border-line"
        }`}
      >
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted ${className ?? ""}`}
          {...inputProps}
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
