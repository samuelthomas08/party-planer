"use client";

import { useQueryClient, useQuery } from "@tanstack/react-query";
import { PartyPopper } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { keys } from "@/lib/queries";
import type { User } from "@/lib/types";
import { Button } from "./ui/Button";
import { PasswordInput, TextInput } from "./ui/Field";
import { Card, ErrorNote, Spinner } from "./ui/misc";

interface Preview {
  email: string | null;
  invitedBy: string;
  expiresAt: string;
}

/** Landing page of an invitation link: choose a name and a password, and the account exists. */
export function InviteAccept() {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const qc = useQueryClient();
  const { token } = useParams<{ token: string }>();
  const { data, isPending, isError } = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => api.get<Preview>(`/invite/${token}`),
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const user = await api.post<User>(`/invite/${token}/accept`, {
        email: data?.email ?? form.get("email"),
        displayName: form.get("displayName"),
        password: form.get("password"),
      });
      log.info("INVITE_ACCEPT_OK", "account created from invitation", { role: user.role });
      qc.setQueryData(keys.me, user);
      router.replace("/");
    } catch (err) {
      log.warn("INVITE_ACCEPT_FAILED", err instanceof ApiError ? err.code : "unknown");
      setError(err);
      setBusy(false);
    }
  };

  if (isPending) return <Spinner label={t("common.loading")} />;

  if (isError || !data) {
    return (
      <Card className="p-6 text-center sm:p-8">
        <h1 className="text-xl font-extrabold">{t("invite.invalidTitle")}</h1>
        <p className="mt-2 text-ink-soft">{t("invite.invalidText")}</p>
        <Link href="/login" className="mt-5 inline-block font-bold text-brand-600 hover:underline dark:text-brand-300">
          {t("auth.loginSubmit")}
        </Link>
      </Card>
    );
  }

  const fieldErrors = error instanceof ApiError ? error.fields : undefined;

  return (
    <Card className="p-6 sm:p-8">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-party-500 text-white">
        <PartyPopper className="size-6" />
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("invite.welcome")}</h1>
      <p className="mt-1 text-ink-soft">
        {data.invitedBy ? t("invite.invitedBy", { name: data.invitedBy }) : t("invite.invited")}{" "}
        {t("invite.validUntil", { date: format.dateTime(new Date(data.expiresAt), { dateStyle: "medium", timeStyle: "short" }) })}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <TextInput name="displayName" label={t("auth.displayName")} autoComplete="name" required maxLength={80} autoFocus />
        {data.email ? (
          <TextInput name="email" type="email" label={t("auth.email")} value={data.email} readOnly />
        ) : (
          <TextInput
            name="email"
            type="email"
            label={t("auth.email")}
            autoComplete="email"
            autoCapitalize="none"
            required
            error={fieldErrors?.email ? t("auth.emailInvalid") : undefined}
          />
        )}
        <PasswordInput
          name="password"
          label={t("auth.password")}
          autoComplete="new-password"
          required
          minLength={10}
          hint={t("auth.passwordHint")}
          error={fieldErrors?.password ? t("auth.passwordTooShort") : undefined}
          showLabel={t("auth.showPassword")}
          hideLabel={t("auth.hidePassword")}
        />
        {error != null && !fieldErrors && <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>}
        <Button type="submit" size="lg" full loading={busy}>
          {t("invite.createAccount")}
        </Button>
      </form>
    </Card>
  );
}
