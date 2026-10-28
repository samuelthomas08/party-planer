"use client";

import clsx from "clsx";
import { Activity, ScrollText, SlidersHorizontal, User as UserIcon, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/queries";

/** Settings sections; admin-only sections are hidden for normal users. */
export function SettingsNav() {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const { data: me } = useMe();
  const items = [
    { href: "/settings", label: t("nav.profile"), icon: UserIcon, admin: false },
    { href: "/settings/users", label: t("nav.users"), icon: Users, admin: true },
    { href: "/settings/audit", label: t("nav.audit"), icon: ScrollText, admin: true },
    { href: "/settings/logs", label: t("nav.logs"), icon: Activity, admin: true },
    { href: "/settings/system", label: t("nav.system"), icon: SlidersHorizontal, admin: true },
  ].filter((i) => !i.admin || me?.role === "ADMIN");

  return (
    <nav aria-label={t("title")} className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="flex gap-2 lg:flex-col lg:gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/settings" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors lg:rounded-control",
                  active ? "bg-brand-600 text-white" : "bg-surface text-ink-soft hover:bg-sunken lg:bg-transparent",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
