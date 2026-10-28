"use client";

import clsx from "clsx";
import { Download, Pause, Play, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { log } from "@/lib/logger";
import type { LogEntry } from "@/lib/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Field";
import { useToast } from "../ui/Toast";

const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const;
const RANK: Record<string, number> = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 };
const MAX_LINES = 2000;

const levelClass: Record<string, string> = {
  TRACE: "text-ink-faint",
  DEBUG: "text-ink-faint",
  INFO: "text-brand-600 dark:text-brand-300",
  WARN: "text-amber-600 dark:text-amber-400",
  ERROR: "text-danger-600 dark:text-danger-500",
};

/** Live server log over Server-Sent Events: backlog first, then every new line as it happens. */
export function LiveLog() {
  const t = useTranslations("logs");
  const format = useFormatter();
  const toast = useToast();

  const [lines, setLines] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);
  const [minLevel, setMinLevel] = useState<string>("INFO");
  const [query, setQuery] = useState("");
  const [serverLevel, setServerLevel] = useState<string>("INFO");
  const [open, setOpen] = useState<number | null>(null);

  const pending = useRef<LogEntry[]>([]);
  const pausedRef = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Connection: EventSource reconnects by itself and resumes with Last-Event-ID.
  useEffect(() => {
    let source: EventSource | null = null;
    let closed = false;
    const connect = () => {
      source = new EventSource("/api/admin/logs/stream?backlog=400");
      source.onopen = () => setConnected(true);
      source.onerror = () => {
        setConnected(false);
        // The session may simply have expired: touching the API refreshes it before the browser retries.
        void api.get("/auth/me").catch(() => {});
        if (source?.readyState === EventSource.CLOSED && !closed) setTimeout(connect, 3000);
      };
      source.addEventListener("log", (e) => {
        pending.current.push(JSON.parse((e as MessageEvent).data) as LogEntry);
      });
    };
    connect();
    log.info("LIVELOG_OPEN", "live log connected");

    // Render at most 4 times a second, however fast lines arrive.
    const timer = setInterval(() => {
      if (pausedRef.current || pending.current.length === 0) return;
      const batch = pending.current.splice(0);
      setLines((prev) => {
        const next = prev.concat(batch);
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    }, 250);
    return () => {
      closed = true;
      clearInterval(timer);
      source?.close();
    };
  }, []);

  useEffect(() => {
    api.get<{ level: string }>("/admin/logs/level").then((r) => setServerLevel(r.level)).catch(() => {});
  }, []);

  const visible = lines.filter(
    (l) =>
      RANK[l.level] >= RANK[minLevel] &&
      (query === "" || `${l.message} ${l.logger} ${l.requestId ?? ""} ${l.user ?? ""}`.toLowerCase().includes(query.toLowerCase())),
  );

  useEffect(() => {
    if (follow && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [visible.length, follow]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (el) setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }, []);

  const changeServerLevel = async (level: string) => {
    try {
      await api.put("/admin/logs/level", { level });
      setServerLevel(level);
      toast(t("levelChanged", { level }));
    } catch {
      toast(t("levelFailed"), "error");
    }
  };

  const download = () => {
    const text = visible
      .map((l) => `${l.ts} ${l.level.padEnd(5)} [${l.requestId ?? "-"}] [${l.user ?? "-"}] ${l.logger} : ${l.message}${l.stack ? "\n" + l.stack : ""}`)
      .join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `party-planer-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <span
          className={clsx(
            "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold",
            connected ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500" : "bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-500",
          )}
          role="status"
        >
          <span className={clsx("size-2 rounded-full", connected ? "animate-pulse bg-current" : "bg-current")} />
          {connected ? t("connected") : t("disconnected")}
        </span>
        <div className="w-36">
          <Select label={t("minLevel")} value={minLevel} onChange={(e) => setMinLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-40 flex-1">
          <label className="mb-1.5 block text-sm font-semibold" htmlFor="log-search">
            {t("search")}
          </label>
          <input
            id="log-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 w-full rounded-control border border-line-strong bg-surface px-3.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="w-40">
          <Select label={t("serverLevel")} value={serverLevel} onChange={(e) => changeServerLevel(e.target.value)} hint={t("serverLevelHint")}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon={paused ? <Play className="size-4" /> : <Pause className="size-4" />} onClick={() => setPaused((p) => !p)}>
          {paused ? t("resume") : t("pause")}
        </Button>
        <Button variant="secondary" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setLines([])}>
          {t("clear")}
        </Button>
        <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={download} disabled={visible.length === 0}>
          {t("download")}
        </Button>
        <span className="ml-auto text-sm text-ink-faint">{t("count", { shown: visible.length, total: lines.length })}</span>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="h-[62dvh] overflow-auto rounded-card border border-line bg-surface font-mono text-[0.78rem] leading-5 shadow-card"
        role="log"
        aria-live="off"
        aria-label={t("title")}
      >
        {visible.length === 0 ? (
          <p className="p-6 text-center font-sans text-ink-faint">{t("empty")}</p>
        ) : (
          visible.map((l) => (
            <div key={l.seq} className={clsx("border-b border-line/60 px-3 py-1.5", l.level === "ERROR" && "bg-danger-50/60 dark:bg-danger-500/10")}>
              <button type="button" className="block w-full text-left" onClick={() => setOpen(open === l.seq ? null : l.seq)} disabled={!l.stack}>
                <span className="mr-2 text-ink-faint">{format.dateTime(new Date(l.ts), { timeStyle: "medium" })}</span>
                <span className={clsx("mr-2 inline-block w-11 font-bold", levelClass[l.level])}>{l.level}</span>
                {l.requestId && <span className="mr-2 text-ink-faint">[{l.requestId}]</span>}
                {l.user && <span className="mr-2 text-party-600 dark:text-party-300">[{l.user}]</span>}
                <span className="mr-2 text-ink-faint">{l.logger.replace("app.partyplaner.", "")}</span>
                <span className="break-words whitespace-pre-wrap">{l.message}</span>
                {l.stack && <span className="ml-2 text-ink-faint">{open === l.seq ? "▾" : "▸"}</span>}
              </button>
              {l.stack && open === l.seq && <pre className="mt-1 overflow-x-auto rounded bg-sunken p-2 text-danger-600 dark:text-danger-500">{l.stack}</pre>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
