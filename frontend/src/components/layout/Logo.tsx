import clsx from "clsx";

/** The original wordmark: just the product name, no icon. */
export function Logo({ className }: { className?: string }) {
  return <span className={clsx("text-xl font-extrabold tracking-tight text-ink", className)}>Party Planer</span>;
}
