"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Share2, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { keys, useShares } from "@/lib/queries";
import type { ShareLink } from "@/lib/types";
import { Button, IconButton } from "../ui/Button";
import { Select } from "../ui/Field";
import { Badge } from "../ui/misc";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

const EXPIRY_OPTIONS = [
  { value: "24", key: "h24" },
  { value: "168", key: "d7" },
  { value: "720", key: "d30" },
  { value: "never", key: "never" },
] as const;

/** Dialog to create, copy and revoke the share links of a place. */
export function ShareSheet({ placeId, placeName, open, onClose }: { placeId: string; placeName: string; open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: links = [], isPending } = useShares(placeId, open);
  const [expiry, setExpiry] = useState("168");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const urlFor = (l: ShareLink) => `${window.location.origin}/share/${l.token}`;
  const refresh = () => qc.invalidateQueries({ queryKey: keys.shares(placeId) });

  const create = async () => {
    setBusy(true);
    try {
      await api.post(`/places/${placeId}/shares`, { expiresInHours: expiry === "never" ? null : Number(expiry) });
      log.info("SHARE_CREATE_OK", "share link created", { placeId });
      await refresh();
    } catch (err) {
      toast(t(`errors.${errorKey(err)}`), "error");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (l: ShareLink) => {
    try {
      await api.delete(`/places/${placeId}/shares/${l.id}`);
      log.info("SHARE_REVOKE_OK", "share link revoked", { placeId, shareId: l.id });
      toast(t("share.revoked"));
      await refresh();
    } catch (err) {
      toast(t(`errors.${errorKey(err)}`), "error");
    }
  };

  const copy = async (l: ShareLink) => {
    try {
      await navigator.clipboard.writeText(urlFor(l));
      setCopied(l.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast(t("share.copyFailed"), "error");
    }
  };

  const nativeShare = (l: ShareLink) =>
    navigator.share({ title: placeName, text: t("share.shareText", { name: placeName }), url: urlFor(l) }).catch(() => {});

  return (
    <Sheet open={open} onClose={onClose} title={t("share.title")} closeLabel={t("common.close")}>
      <div className="space-y-5 pb-2">
        <p className="text-sm text-ink-soft">{t("share.intro")}</p>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select label={t("share.expires")} value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`share.expiry.${o.key}`)}
                </option>
              ))}
            </Select>
          </div>
          <Button loading={busy} onClick={create} icon={<Link2 className="size-4" />} className="h-12">
            {t("share.create")}
          </Button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-faint">{t("share.links")}</h3>
          {isPending ? (
            <p className="text-sm text-ink-faint">{t("common.loading")}</p>
          ) : links.length === 0 ? (
            <p className="rounded-control bg-sunken px-3 py-3 text-sm text-ink-soft">{t("share.none")}</p>
          ) : (
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.id} className="rounded-control border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone={l.active ? "brand" : "neutral"}>
                      {l.revokedAt ? t("share.statusRevoked") : l.active ? t("share.statusActive") : t("share.statusExpired")}
                    </Badge>
                    <span className="text-xs text-ink-faint">
                      {l.expiresAt
                        ? t("share.until", { date: format.dateTime(new Date(l.expiresAt), { dateStyle: "medium", timeStyle: "short" }) })
                        : t("share.noExpiry")}
                    </span>
                  </div>
                  {l.active && (
                    <>
                      <input
                        readOnly
                        value={urlFor(l)}
                        aria-label={t("share.linkLabel")}
                        onFocus={(e) => e.currentTarget.select()}
                        className="mb-2 h-11 w-full rounded-control border border-line-strong bg-sunken px-3 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => copy(l)} icon={copied === l.id ? <Check className="size-4" /> : <Copy className="size-4" />}>
                          {copied === l.id ? t("share.copied") : t("share.copy")}
                        </Button>
                        {typeof navigator !== "undefined" && "share" in navigator && (
                          <Button size="sm" variant="secondary" onClick={() => nativeShare(l)} icon={<Share2 className="size-4" />}>
                            {t("share.button")}
                          </Button>
                        )}
                        <IconButton label={t("share.revoke")} tone="danger" className="ml-auto" onClick={() => revoke(l)}>
                          <Trash2 className="size-5" />
                        </IconButton>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}
