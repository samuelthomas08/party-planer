/**
 * Client-side logger. Everything goes to the browser console; info and above is also shipped to the backend
 * (/api/client-logs) in small batches, so the admin "live log" shows what the browser did next to what the
 * server did. Never log secrets or personal data: only ids, event codes and error codes.
 */

type Level = "debug" | "info" | "warn" | "error";

interface Entry {
  level: Level;
  event: string;
  message: string;
  url: string;
  data?: string;
}

const FLUSH_MS = 2000;
const MAX_BATCH = 50;
const queue: Entry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let pausedUntil = 0;

function csrf(): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="));
  return match ? decodeURIComponent(match.slice("XSRF-TOKEN=".length)) : null;
}

async function flush() {
  timer = null;
  if (queue.length === 0 || typeof document === "undefined") return;
  const token = csrf();
  if (!token || Date.now() < pausedUntil) {
    // Not signed in (yet): keep a small tail so early events are not lost, drop the rest.
    queue.splice(0, Math.max(0, queue.length - 20));
    return;
  }
  const entries = queue.splice(0, MAX_BATCH);
  try {
    const res = await fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": token },
      body: JSON.stringify({ entries }),
      keepalive: true,
      credentials: "same-origin",
    });
    // Guests and logged-out sessions are not allowed to write logs: stop trying for a while.
    if ([401, 403, 429].includes(res.status)) pausedUntil = Date.now() + 60_000;
  } catch {
    /* offline: the console copy is enough */
  }
  if (queue.length > 0) schedule();
}

function schedule(immediately = false) {
  if (timer && !immediately) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, immediately ? 0 : FLUSH_MS);
}

function write(level: Level, event: string, message: string, data?: Record<string, unknown>) {
  const line = `[${event}] ${message}`;
  const fn = level === "debug" ? console.debug : level === "info" ? console.info : level === "warn" ? console.warn : console.error;
  if (data) fn(line, data);
  else fn(line);

  if (level === "debug" || typeof window === "undefined") return;
  queue.push({
    level,
    event,
    message: message.slice(0, 590),
    url: window.location.pathname.slice(0, 190),
    data: data ? JSON.stringify(data).slice(0, 590) : undefined,
  });
  schedule(level === "error");
}

/** Application logger: console always, server log for info and above. */
export const log = {
  debug: (event: string, message = "", data?: Record<string, unknown>) => write("debug", event, message, data),
  info: (event: string, message = "", data?: Record<string, unknown>) => write("info", event, message, data),
  warn: (event: string, message = "", data?: Record<string, unknown>) => write("warn", event, message, data),
  error: (event: string, message = "", data?: Record<string, unknown>) => write("error", event, message, data),
};

let installed = false;

/** Catches errors nobody else handled. Safe to call more than once. */
export function installGlobalLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => log.error("UNCAUGHT_ERROR", e.message || "error", { file: e.filename, line: e.lineno }));
  window.addEventListener("unhandledrejection", (e) =>
    log.error("UNHANDLED_REJECTION", e.reason instanceof Error ? e.reason.message : String(e.reason)),
  );
  window.addEventListener("pagehide", () => void flush());
  log.info("APP_START", "client started", { ua: navigator.userAgent.slice(0, 120), w: window.innerWidth });
}
