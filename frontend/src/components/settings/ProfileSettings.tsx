"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { keys, useMe } from "@/lib/queries";
import type { User } from "@/lib/types";
import { Button } from "../ui/Button";
import { PasswordInput, TextInput } from "../ui/Field";
import { Badge, Card, ErrorNote } from "../ui/misc";
import { useToast } from "../ui/Toast";

/** Own display name and password. */
export function ProfileSettings() {
  const t = useTranslations();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState<"name" | "pw" | null>(null);
  const [pwError, setPwError] = useState<unknown>(null);

  if (!me) return null;

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("name");
    try {
      const user = await api.patch<User>("/auth/profile", { displayName: name ?? me.displayName });
      qc.setQueryData(keys.me, user);
      log.info("PROFILE_NAME_SAVED", "display name updated");
      toast(t("settings.saved"));
    } catch (err) {
      toast(t(`errors.${errorKey(err)}`), "error");
    } finally {
      setBusy(null);
    }
  };

  const savePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy("pw");
    setPwError(null);
    try {
      await api.post("/auth/password", { currentPassword: data.get("current"), newPassword: data.get("next") });
      log.info("PASSWORD_CHANGED", "password changed, other sessions signed out");
      toast(t("settings.passwordChanged"));
      form.reset();
    } catch (err) {
      setPwError(err);
    } finally {
      setBusy(null);
    }
  };

  const showLabel = t("auth.showPassword");
  const hideLabel = t("auth.hidePassword");

  return (
    <div className="grid max-w-5xl gap-5 xl:grid-cols-2">
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold">{t("settings.profile")}</h2>
          <Badge tone={me.role === "ADMIN" ? "party" : "brand"}>{t(`audit.role.${me.role}`)}</Badge>
        </div>
        <form onSubmit={saveName} className="space-y-4">
          <TextInput label={t("auth.email")} value={me.email} readOnly disabled />
          <TextInput label={t("auth.displayName")} value={name ?? me.displayName} maxLength={80} required onChange={(e) => setName(e.target.value)} />
          <Button type="submit" loading={busy === "name"}>
            {t("common.save")}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-lg font-bold">{t("settings.password")}</h2>
        <p className="mb-4 text-sm text-ink-soft">{t("settings.passwordHint")}</p>
        <form onSubmit={savePassword} className="space-y-4">
          <PasswordInput name="current" label={t("settings.currentPassword")} autoComplete="current-password" required showLabel={showLabel} hideLabel={hideLabel} />
          <PasswordInput name="next" label={t("settings.newPassword")} autoComplete="new-password" required minLength={10} hint={t("auth.passwordHint")} showLabel={showLabel} hideLabel={hideLabel} />
          {pwError != null && <ErrorNote>{t(`errors.${errorKey(pwError)}`)}</ErrorNote>}
          <Button type="submit" loading={busy === "pw"}>
            {t("settings.changePassword")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
