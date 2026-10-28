"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { keys, useMe } from "@/lib/queries";
import type { User } from "@/lib/types";
import { Button } from "./ui/Button";
import { PasswordInput, TextInput } from "./ui/Field";
import { Card, ErrorNote } from "./ui/misc";

/** Login / registration form. Errors are mapped to translated messages without revealing which part was wrong. */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: existing } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (existing) router.replace("/");
  }, [existing, router]);

  const register = mode === "register";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const user = await api.post<User>(
        register ? "/auth/register" : "/auth/login",
        register
          ? { email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") }
          : { email: form.get("email"), password: form.get("password") },
      );
      log.info(register ? "AUTH_REGISTER_OK" : "AUTH_LOGIN_OK", "signed in", { role: user.role });
      qc.setQueryData(keys.me, user);
      router.replace("/");
    } catch (err) {
      log.warn(register ? "AUTH_REGISTER_FAILED" : "AUTH_LOGIN_FAILED", err instanceof ApiError ? err.code : "unknown");
      setError(err);
      setBusy(false);
    }
  };

  const fieldErrors = error instanceof ApiError ? error.fields : undefined;
  const passwordError = fieldErrors?.password ? t("auth.passwordTooShort") : undefined;

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{register ? t("auth.registerTitle") : t("auth.loginTitle")}</h1>
      <p className="mt-1 text-ink-soft">{register ? t("auth.registerSubtitle") : t("auth.loginSubtitle")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate={false}>
        {register && (
          <TextInput
            name="displayName"
            label={t("auth.displayName")}
            autoComplete="name"
            required
            maxLength={80}
            error={fieldErrors?.displayName ? t("errors.VALIDATION_FAILED") : undefined}
          />
        )}
        <TextInput
          name="email"
          type="email"
          label={t("auth.email")}
          autoComplete={register ? "email" : "username"}
          inputMode="email"
          autoCapitalize="none"
          required
          error={fieldErrors?.email ? t("auth.emailInvalid") : undefined}
        />
        <PasswordInput
          name="password"
          label={t("auth.password")}
          autoComplete={register ? "new-password" : "current-password"}
          required
          minLength={register ? 10 : undefined}
          hint={register ? t("auth.passwordHint") : undefined}
          error={passwordError}
          showLabel={t("auth.showPassword")}
          hideLabel={t("auth.hidePassword")}
        />

        {error != null && !fieldErrors && <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>}

        <Button type="submit" size="lg" full loading={busy}>
          {register ? t("auth.registerSubmit") : t("auth.loginSubmit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {register ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
        <Link href={register ? "/login" : "/register"} className="font-bold text-brand-600 hover:underline dark:text-brand-300">
          {register ? t("auth.loginLink") : t("auth.registerLink")}
        </Link>
      </p>
    </Card>
  );
}
