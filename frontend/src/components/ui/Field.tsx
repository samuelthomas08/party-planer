"use client";

import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-control border bg-surface px-3.5 text-ink placeholder:text-ink-faint " +
  "border-line-strong transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 " +
  "disabled:opacity-60 aria-[invalid=true]:border-danger-500 aria-[invalid=true]:ring-danger-500/20";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label, control and error / hint text wired together for accessibility. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-sm text-danger-600 dark:text-danger-500">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };

/** Labelled text input. */
export function TextInput({ label, hint, error, className, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={clsx(control, "h-12", className)}
          {...rest}
        />
      )}
    </Field>
  );
}

/** Password input with a show / hide toggle. */
export function PasswordInput({
  label,
  hint,
  error,
  showLabel,
  hideLabel,
  ...rest
}: InputProps & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            type={visible ? "text" : "password"}
            className={clsx(control, "h-12 pr-12")}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? hideLabel : showLabel}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-faint hover:text-ink"
          >
            {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      )}
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string };

/** Labelled textarea. */
export function TextArea({ label, hint, error, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={clsx(control, "min-h-28 py-3", className)}
          {...rest}
        />
      )}
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string };

/** Labelled native select. */
export function Select({ label, hint, error, className, children, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={clsx(control, "h-12 appearance-none bg-no-repeat pr-10", className)}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236e7596' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/></svg>\")",
            backgroundPosition: "right 0.75rem center",
            backgroundSize: "1.25rem",
          }}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
}
