"use client";

import { useQuery } from "@tanstack/react-query";
import { LinkIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { Button } from "./ui/Button";
import { TextInput } from "./ui/Field";
import { Card, ErrorNote, Spinner } from "./ui/misc";

interface Preview {
  placeName: string;
  sharedBy: string;
  expiresAt: string | null;
}

/** Landing page of a share link: pick a name, continue as guest, read-only access to that one place. */
export function ShareLanding() {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { data, isPending, isError } = useQuery({
    queryKey: ["share-preview", token],
    queryFn: () => api.get<Preview>(`/share/${token}`),
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const join = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/share/${token}/guest`, { name });
      log.info("GUEST_JOIN_OK", "joined as guest");
      router.push("/guest");
    } catch (err) {
      log.warn("GUEST_JOIN_FAILED", String(err instanceof Error ? err.message : err));
      setError(err);
      setBusy(false);
    }
  };

  if (isPending) return <Spinner label={t("common.loading")} />;

  if (isError || !data) {
    return (
      <Card className="p-6 text-center sm:p-8">
        <h1 className="text-xl font-extrabold">{t("share.invalidTitle")}</h1>
        <p className="mt-2 text-ink-soft">{t("share.invalidText")}</p>
        <Link href="/login" className="mt-5 inline-block font-bold text-brand-600 hover:underline dark:text-brand-300">
          {t("auth.loginSubmit")}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-sunken dark:text-brand-300">
        <LinkIcon className="size-6" />
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight">{data.placeName}</h1>
      <p className="mt-1 text-ink-soft">
        {data.sharedBy ? t("share.invitedBy", { name: data.sharedBy }) : t("share.invited")}
        {data.expiresAt && (
          <> {t("share.validUntil", { date: format.dateTime(new Date(data.expiresAt), { dateStyle: "medium", timeStyle: "short" }) })}</>
        )}
      </p>
      <form onSubmit={join} className="mt-6 space-y-4">
        <TextInput name="name" label={t("share.yourName")} hint={t("share.nameHint")} required maxLength={60} autoComplete="nickname" autoFocus />
        {error != null && <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>}
        <Button type="submit" size="lg" full loading={busy}>
          {t("share.continueAsGuest")}
        </Button>
      </form>
    </Card>
  );
}
