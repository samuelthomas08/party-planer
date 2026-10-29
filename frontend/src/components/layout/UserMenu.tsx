"use client";

import clsx from "clsx";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { log } from "@/lib/logger";
import Link from "next/link";
import { Settings } from "lucide-react";
import { LOCALES } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";
import type { User } from "@/lib/types";

type Theme = "system" | "light" | "dark";

function applyTheme(theme: Theme) {
  try {
    if (theme === "system") {
      localStorage.removeItem("pp-theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("pp-theme", theme);
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    /* storage unavailable (private mode): theme just won't persist */
  }
}

/** Account menu: language, theme, settings and logout. */
export function UserMenu({ user }: { user: User }) {
  const t = useTranslations("menu");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the pre-hydration choice once
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logout = async () => {
    log.info("AUTH_LOGOUT", "user logged out");
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // The local session is dropped either way; the server-side session simply expires on its own.
      log.warn("AUTH_LOGOUT_FAILED", err instanceof Error ? err.message : "unknown");
    } finally {
      qc.clear();
      router.replace("/login");
    }
  };

  const pickLocale = (next: string) =>
    startTransition(async () => {
      log.info("LOCALE_CHANGED", next);
      await setLocale(next);
      router.refresh();
    });

  const pickTheme = (next: Theme) => {
    log.info("THEME_CHANGED", next);
    setTheme(next);
    applyTheme(next);
  };

  const initials = user.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: t("themeSystem"), icon: <Monitor className="size-4" /> },
    { value: "light", label: t("themeLight"), icon: <Sun className="size-4" /> },
    { value: "dark", label: t("themeDark"), icon: <Moon className="size-4" /> },
  ];

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account")}
        className="flex size-11 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-100"
      >
        {initials || "?"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-13 z-50 w-72 max-w-[calc(100vw-2rem)] origin-top-right rounded-card border border-line bg-surface p-3 shadow-pop animate-pop-in"
        >
          <div className="px-2 pb-3">
            <p className="truncate font-bold">{user.displayName}</p>
            <p className="truncate text-sm text-ink-faint">{user.email}</p>
          </div>

          <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">{t("language")}</p>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-control bg-sunken p-1">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => pickLocale(l)}
                aria-pressed={l === locale}
                className={clsx(
                  "h-9 rounded-[0.65rem] text-sm font-semibold uppercase",
                  l === locale ? "bg-surface text-brand-700 shadow-sm dark:text-brand-200" : "text-ink-soft",
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">{t("theme")}</p>
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-control bg-sunken p-1">
            {themeOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => pickTheme(o.value)}
                aria-pressed={o.value === theme}
                aria-label={o.label}
                title={o.label}
                className={clsx(
                  "flex h-9 items-center justify-center rounded-[0.65rem]",
                  o.value === theme ? "bg-surface text-brand-700 shadow-sm dark:text-brand-200" : "text-ink-soft",
                )}
              >
                {o.icon}
              </button>
            ))}
          </div>

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mb-1 flex h-11 w-full items-center gap-2 rounded-control px-2 font-semibold text-ink-soft hover:bg-sunken"
          >
            <Settings className="size-5" />
            {t("settings")}
          </Link>
          <button
            role="menuitem"
            onClick={logout}
            className="flex h-11 w-full items-center gap-2 rounded-control px-2 font-semibold text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-sunken"
          >
            <LogOut className="size-5" />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
