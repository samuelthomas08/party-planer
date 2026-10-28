import clsx from "clsx";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/50",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-sunken active:bg-sunken disabled:opacity-50",
  ghost: "text-ink-soft hover:bg-sunken active:bg-sunken disabled:opacity-50",
  danger: "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600 disabled:bg-danger-500/50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-base gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

/** Props of {@link Button}. */
function buttonClass(variant: Variant, size: Size, full?: boolean, className?: string) {
  return clsx(
    "inline-flex select-none items-center justify-center rounded-control font-semibold transition-colors",
    "disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    full && "w-full",
    className,
  );
}

type IconTone = "default" | "danger" | "brand";

function iconButtonClass(tone: IconTone, className?: string) {
  return clsx(
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
    tone === "default" && "text-ink-soft hover:bg-sunken active:bg-sunken",
    tone === "brand" && "text-brand-600 hover:bg-brand-50 active:bg-brand-100 dark:text-brand-300 dark:hover:bg-sunken",
    tone === "danger" && "text-danger-500 hover:bg-danger-50 active:bg-danger-50 dark:hover:bg-sunken",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
}

/** Primary UI button (variants, sizes, loading state). */
export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  full,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClass(variant, size, full, className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** Props of {@link IconButton}. */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: IconTone;
}

/** Always 44×44 so it is comfortable to hit with a thumb. */
export function IconButton({ label, tone = "default", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClass(tone, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A real link that looks like a {@link Button} (never a button inside a link, which is invalid HTML). */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  full,
  className,
  children,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; variant?: Variant; size?: Size; icon?: ReactNode; full?: boolean }) {
  return (
    <Link href={href} className={buttonClass(variant, size, full, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** A real link that looks like an {@link IconButton}. */
export function IconLink({
  href,
  label,
  tone = "default",
  className,
  children,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; label: string; tone?: IconTone }) {
  return (
    <Link href={href} aria-label={label} title={label} className={iconButtonClass(tone, className)} {...rest}>
      {children}
    </Link>
  );
}
