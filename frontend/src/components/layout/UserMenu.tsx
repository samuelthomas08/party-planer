"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { log } from "@/lib/logger";
import Link from "next/link";
import { Settings } from "lucide-react";
import type { User } from "@/lib/types";

/** Account menu: link to the settings and logout. */
export function UserMenu({ user }: { user: User }) {
  const t = useTranslations("menu");
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  const initials = user.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account")}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-100"
      >
        {initials || "?"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-13 z-50 w-72 max-w-[calc(100vw-2rem)] origin-top-right rounded-card border border-line bg-surface p-3 shadow-pop animate-pop-in"
        >
          <div className="px-2 pb-2">
            <p className="truncate font-bold">{user.displayName}</p>
            <p className="truncate text-sm text-ink-faint">{user.email}</p>
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
            className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-control px-2 font-semibold text-danger-600 hover:bg-danger-50 dark:text-danger-500 dark:hover:bg-sunken"
          >
            <LogOut className="size-5" />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
