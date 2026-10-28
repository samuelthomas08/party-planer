"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { keys, useRegistrationSetting } from "@/lib/queries";
import { Card, ErrorNote, Spinner } from "../ui/misc";
import { useToast } from "../ui/Toast";

/** Runtime system switches (currently: open registration). */
export function SystemSettings() {
  const t = useTranslations();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isPending, error } = useRegistrationSetting();
  const [busy, setBusy] = useState(false);

  if (isPending) return <Spinner label={t("common.loading")} />;
  if (error || !data) return <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>;

  const toggle = async () => {
    setBusy(true);
    try {
      const next = !data.registrationEnabled;
      await api.put("/admin/settings", { registrationEnabled: next });
      log.info("SETTINGS_REGISTRATION_TOGGLED", String(next));
      toast(t("settings.saved"));
      await qc.invalidateQueries({ queryKey: keys.adminSettings });
    } catch (err) {
      toast(t(`errors.${errorKey(err)}`), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-2xl p-5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{t("settings.registration")}</h2>
          <p className="text-sm text-ink-soft">{t("settings.registrationHint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={data.registrationEnabled}
          aria-label={t("settings.registration")}
          disabled={busy}
          onClick={toggle}
          className={clsx(
            "relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60",
            data.registrationEnabled ? "bg-brand-600" : "bg-line-strong",
          )}
        >
          <span className={clsx("absolute top-1 size-6 rounded-full bg-white shadow transition-all", data.registrationEnabled ? "left-7" : "left-1")} />
        </button>
      </div>
    </Card>
  );
}
