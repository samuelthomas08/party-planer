"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, MailPlus, Share2, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { keys, useInvitations } from "@/lib/queries";
import type { Invitation, Role } from "@/lib/types";
import { Button, IconButton } from "../ui/Button";
import { Select, TextInput } from "../ui/Field";
import { Badge, ErrorNote, Segmented } from "../ui/misc";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

const EXPIRY = [
  { value: "24", key: "h24" },
  { value: "168", key: "d7" },
  { value: "720", key: "d30" },
] as const;

const tone = { PENDING: "brand", USED: "neutral", REVOKED: "neutral", EXPIRED: "neutral" } as const;

/** Open and past invitations. The link itself is only ever shown once, right after it was created. */
export function InvitationsAdmin() {
  const t = useTranslations("invite");
  const format = useFormatter();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: invitations = [] } = useInvitations();

  const revoke = async (inv: Invitation) => {
    try {
      await api.delete(`/admin/invitations/${inv.id}`);
      log.info("INVITE_REVOKE_OK", "invitation revoked", { id: inv.id });
      toast(t("revoked"));
      await qc.invalidateQueries({ queryKey: keys.invitations });
    } catch (err) {
      toast(t("failed"), "error");
      log.warn("INVITE_REVOKE_FAILED", String(err));
    }
  };

  if (invitations.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="invitations-heading">
      <h2 id="invitations-heading" className="mb-3 text-sm font-bold uppercase tracking-widest text-ink-faint">
        {t("title")}
      </h2>
      <ul className="space-y-2">
        {invitations.map((inv) => (
          <li key={inv.id} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone[inv.status]}>{t(`status.${inv.status}`)}</Badge>
                <Badge tone="neutral">{t(`role.${inv.role}`)}</Badge>
                <span className="min-w-0 truncate text-sm font-semibold">{inv.email ?? t("anyEmail")}</span>
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {inv.status === "PENDING"
                  ? t("expires", { date: format.dateTime(new Date(inv.expiresAt), { dateStyle: "medium", timeStyle: "short" }) })
                  : t("created", { date: format.dateTime(new Date(inv.createdAt), { dateStyle: "medium", timeStyle: "short" }) })}
              </p>
            </div>
            {inv.status === "PENDING" && (
              <IconButton label={t("revoke")} tone="danger" onClick={() => revoke(inv)}>
                <Trash2 className="size-5" />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Dialog to create an invitation; the link is displayed once, right after creation. */
export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>("USER");
  const [expiry, setExpiry] = useState("168");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setCreated(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  const link = created?.token ? `${window.location.origin}/invite/${created.token}` : "";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const inv = await api.post<Invitation>("/admin/invitations", { email: email || null, role, expiresInHours: Number(expiry) });
      log.info("INVITE_CREATE_OK", "invitation created", { id: inv.id, role });
      setCreated(inv);
      await qc.invalidateQueries({ queryKey: keys.invitations });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t("share.copyFailed"), "error");
    }
  };

  return (
    <Sheet open={open} onClose={close} title={t("invite.button")} closeLabel={t("common.close")}>
      {created ? (
        <div className="space-y-4 pb-2">
          <p className="text-sm text-ink-soft">{t("invite.createdIntro")}</p>
          <input
            readOnly
            value={link}
            aria-label={t("invite.linkLabel")}
            onFocus={(e) => e.currentTarget.select()}
            className="h-12 w-full rounded-control border border-line-strong bg-sunken px-3 text-sm"
          />
          <p className="rounded-control bg-sunken px-3 py-2 text-sm text-ink-soft">{t("invite.onlyOnce")}</p>
          <div className="flex gap-2">
            <Button onClick={copy} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} className="flex-1">
              {copied ? t("share.copied") : t("share.copy")}
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button
                variant="secondary"
                icon={<Share2 className="size-4" />}
                onClick={() => navigator.share({ title: "Party Planer", text: t("invite.shareText"), url: link }).catch(() => {})}
              >
                {t("share.button")}
              </Button>
            )}
          </div>
          <Button variant="ghost" full onClick={close}>
            {t("common.done")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 pb-2">
          <p className="text-sm text-ink-soft">{t("invite.intro")}</p>
          <TextInput name="email" type="email" label={t("invite.email")} hint={t("invite.emailHint")} autoCapitalize="none" />
          <div>
            <p className="mb-2 text-sm font-semibold">{t("users.role")}</p>
            <Segmented<Role>
              label={t("users.role")}
              value={role}
              onChange={setRole}
              options={[
                { value: "USER", label: t("audit.role.USER") },
                { value: "ADMIN", label: t("audit.role.ADMIN") },
              ]}
            />
          </div>
          <Select label={t("invite.validFor")} value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            {EXPIRY.map((o) => (
              <option key={o.value} value={o.value}>
                {t(`share.expiry.${o.key}`)}
              </option>
            ))}
          </Select>
          {error != null && <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>}
          <Button type="submit" size="lg" full loading={busy} icon={<MailPlus className="size-5" />}>
            {t("invite.generate")}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
