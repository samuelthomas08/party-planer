"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { LOCALES } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { log } from "@/lib/logger";
import { Card, Segmented } from "../ui/misc";

type Theme = "system" | "light" | "dark";

/** Language names are shown in their own language, so they are recognisable whatever the UI language is. */
const LOCALE_NAMES: Record<Locale, string> = { de: "Deutsch", en: "English" };

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

/** Language and theme (light / dark / system) of the app. */
export function AppearanceSettings() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("system");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the pre-hydration choice once
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  const pickLocale = (next: Locale) =>
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

  return (
    <Card className="space-y-5 p-5">
      <h2 className="text-lg font-bold">{t("appearance")}</h2>
      <div>
        <p className="mb-2 text-sm font-semibold">{t("language")}</p>
        <Segmented<Locale>
          label={t("language")}
          value={locale as Locale}
          onChange={pickLocale}
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">{t("theme")}</p>
        <Segmented<Theme>
          label={t("theme")}
          value={theme}
          onChange={pickTheme}
          options={[
            { value: "system", label: t("themeSystem"), icon: <Monitor className="size-4" /> },
            { value: "light", label: t("themeLight"), icon: <Sun className="size-4" /> },
            { value: "dark", label: t("themeDark"), icon: <Moon className="size-4" /> },
          ]}
        />
      </div>
    </Card>
  );
}
