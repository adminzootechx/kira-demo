"use client";

import { useId } from "react";
import { Check } from "lucide-react";

/**
 * Form controls for the account surfaces. The product had no input primitives
 * before this, so settings would otherwise have invented one-off styles — these
 * carry the same hairlines, radii and focus behaviour as everything else.
 */

const control =
  "h-10 w-full rounded-[10px] border border-border bg-card px-3 text-[13.5px] text-navy outline-none transition-colors placeholder:text-muted-foreground hover:border-[#d8dfeb] focus:border-accent disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-navy">
        {label}
      </label>
      {hint && <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function TextInput({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={control}
      />
    </Field>
  );
}

export function SelectInput({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${control} cursor-pointer appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2356617a' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * A squared switch rather than the usual rounded pill, so it sits in the same
 * visual system as the rest of the product.
 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-navy">{label}</p>
        {description && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-[4px] border transition-colors ${
          checked ? "border-accent bg-accent" : "border-border bg-muted"
        }`}
      >
        <span
          className={`absolute top-[2px] size-3.5 rounded-[2px] bg-card transition-[left] duration-150 ${
            checked ? "left-[18px]" : "left-[2px]"
          }`}
          aria-hidden
        />
      </button>
    </div>
  );
}

/** Checkbox row used where several options are selected together. */
export function CheckRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2.5">
      <span
        className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
          checked ? "border-accent bg-accent text-white" : "border-border bg-card text-transparent"
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-navy">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/** A labelled row of read-only facts — used for values the user cannot edit. */
export function ReadOnlyRow({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border/70 py-3 last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13.5px] font-medium text-navy">{value}</span>
      {note && <span className="w-full text-[12px] text-muted-foreground">{note}</span>}
    </div>
  );
}
