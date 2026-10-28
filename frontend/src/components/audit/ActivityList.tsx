"use client";

import clsx from "clsx";
import {
  Boxes, FolderCog, KeyRound, LogIn, LogOut, MapPin, Settings, Share2, ShieldCheck, ShieldAlert, UserCog, UserPlus, UsersRound,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { AuditEntry, Change } from "@/lib/types";
import { Badge, Card } from "../ui/misc";

function iconFor(entry: AuditEntry): ReactNode {
  const cls = "size-5";
  switch (entry.action) {
    case "LOGIN": return <LogIn className={cls} />;
    case "LOGOUT": return <LogOut className={cls} />;
    case "LOGIN_FAILED": return <ShieldAlert className={cls} />;
    case "PASSWORD_CHANGED": case "USER_PASSWORD_RESET": return <KeyRound className={cls} />;
    case "USER_REGISTERED": case "USER_CREATED": case "INVITATION_CREATED": case "INVITATION_ACCEPTED": return <UserPlus className={cls} />;
    case "GUEST_JOINED": return <UsersRound className={cls} />;
    case "SETTINGS_CHANGED": case "LOG_LEVEL_CHANGED": return <Settings className={cls} />;
    default:
  }
  switch (entry.entityType) {
    case "PLACE": return <MapPin className={cls} />;
    case "EQUIPMENT": return <Boxes className={cls} />;
    case "FOLDER": return <FolderCog className={cls} />;
    case "SHARE": return <Share2 className={cls} />;
    case "USER": return entry.action.startsWith("USER_") ? <UserCog className={cls} /> : <ShieldCheck className={cls} />;
    default: return <Settings className={cls} />;
  }
}

/** Timeline of "who did what, when, where and how". */
export function ActivityList({ entries, showIp, onPlaceClick }: { entries: AuditEntry[]; showIp?: boolean; onPlaceClick?: (placeId: string) => void }) {
  const t = useTranslations("audit");
  const te = useTranslations("equipment");
  const format = useFormatter();

  // Keys like change.<CODE> come from the server, so they cannot be checked at compile time.
  const td = t as unknown as ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean };
  const none = t("none");
  const now = new Date(); // explicit, so the relative time never depends on a global default
  const slot = (key?: string | null) => (key ? te(`slots.${key}` as never) : "");
  const category = (key?: string | null) => (key ? te(`category.${key}` as never) : none);

  const describe = (c: Change): ReactNode => {
    const params = { ref: c.ref ?? "", from: c.from ?? none, to: c.to ?? none };
    switch (c.code) {
      case "MARKER_COLOR":
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {t("change.MARKER_COLOR", { ref: params.ref })}
            {[c.from, c.to].map((hex, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {i === 1 && <span aria-hidden>→</span>}
                <span className="size-4 rounded-full ring-1 ring-line-strong" style={{ background: hex ?? undefined }} />
                <code className="text-xs">{hex}</code>
              </span>
            ))}
          </span>
        );
      case "CATEGORY":
        return t("change.CATEGORY", { from: category(c.from), to: category(c.to) });
      case "IMAGE_ADDED": case "IMAGE_REMOVED": case "IMAGE_REPLACED":
        return t(`change.${c.code}`, { ref: slot(c.ref) });
      case "EXPIRES":
        return c.to ? t("change.EXPIRES", { to: format.dateTime(new Date(c.to), { dateStyle: "medium", timeStyle: "short" }) }) : t("change.NO_EXPIRY");
      case "REGISTRATION":
        return t("change.REGISTRATION", { to: c.to === "true" ? t("on") : t("off") });
      case "ROLE":
        return t("change.ROLE", { from: c.from ? td(`role.${c.from}`) : none, to: c.to ? td(`role.${c.to}`) : none });
      default:
        return td.has(`change.${c.code}`) ? td(`change.${c.code}`, params) : c.code;
    }
  };

  if (entries.length === 0) {
    return <p className="rounded-card border-2 border-dashed border-line-strong px-4 py-8 text-center text-ink-faint">{t("empty")}</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const at = new Date(e.at);
        const danger = e.action === "LOGIN_FAILED" || e.action.endsWith("DELETED") || e.action === "SHARE_REVOKED" || e.action === "INVITATION_REVOKED";
        return (
          <li key={e.id}>
            <Card className="flex gap-3 p-3.5 sm:p-4">
              <span
                className={clsx(
                  "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full",
                  danger ? "bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-500" : "bg-brand-50 text-brand-600 dark:bg-sunken dark:text-brand-300",
                )}
              >
                {iconFor(e)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {td.has(`action.${e.action}`) ? td(`action.${e.action}`, { name: e.entityName ?? "" }) : e.action}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{e.actorName}</span>
                  {e.actorType === "GUEST" && <Badge tone="party">{t("guest")}</Badge>}
                  {e.actorType === "SYSTEM" && <Badge tone="neutral">{t("system")}</Badge>}
                  <span aria-hidden>·</span>
                  <time dateTime={e.at} title={format.dateTime(at, { dateStyle: "full", timeStyle: "medium" })}>
                    {format.dateTime(at, { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                  <span className="text-ink-faint">({format.relativeTime(at, now)})</span>
                </p>
                {e.placeId && (
                  <p className="mt-1 text-sm">
                    <span className="text-ink-faint">{t("where")}: </span>
                    {onPlaceClick ? (
                      <button type="button" onClick={() => onPlaceClick(e.placeId!)} className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
                        {e.placeName ?? e.placeId}
                      </button>
                    ) : (
                      <span className="font-semibold">{e.placeName ?? e.placeId}</span>
                    )}
                  </p>
                )}
                {e.changes.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded-control bg-sunken px-3 py-2 text-sm">
                    {e.changes.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-ink-faint" aria-hidden>•</span>
                        <span className="min-w-0 break-words">{describe(c)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {showIp && e.ip && <p className="mt-1.5 text-xs text-ink-faint">IP {e.ip}</p>}
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
