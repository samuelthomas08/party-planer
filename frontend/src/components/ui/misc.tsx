import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

/** Surface container. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-card border border-line bg-surface shadow-card", className)} {...rest} />;
}

/** Small status label. */
export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "party" | "neutral" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
        tone === "brand" && "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200",
        tone === "party" && "bg-party-500/15 text-party-600 dark:text-party-300",
        tone === "neutral" && "bg-sunken text-ink-soft",
      )}
    >
      {children}
    </span>
  );
}

/** Loading indicator with an accessible label. */
export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-ink-faint">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Friendly placeholder for empty lists. */
export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-line-strong px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-sunken dark:text-brand-300">
        {icon}
      </div>
      <p className="font-bold">{title}</p>
      {children && <div className="max-w-xs text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

/** One option of {@link Segmented}. */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** Segmented control (tab-style toggle). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-control bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex h-10 items-center justify-center gap-2 rounded-[0.65rem] px-3 text-sm font-semibold transition-colors",
            o.value === value ? "bg-surface text-brand-700 shadow-sm dark:text-brand-200" : "text-ink-soft hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Inline error message. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control bg-danger-50 px-3.5 py-3 text-sm font-medium text-danger-600 dark:bg-danger-500/15 dark:text-danger-500">
      {children}
    </p>
  );
}
