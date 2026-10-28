/**
 * Thin fetch wrapper around the Spring Boot API (proxied at /api).
 *
 * - Auth tokens are httpOnly cookies, so this code never sees them.
 * - Mutating requests echo the XSRF-TOKEN cookie in X-XSRF-TOKEN (double-submit CSRF protection).
 * - A 401 triggers one silent refresh (shared between concurrent requests), then a single retry.
 */

/** Error thrown for any failed API call; `code` is a stable key that is translated in the UI. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields?: Record<string, string>,
  ) {
    super(code);
  }
}

import { log } from "./logger";

/** Fired on `window` when the session could not be renewed. */
export const AUTH_EXPIRED_EVENT = "pp:auth-expired";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function csrfToken(): Promise<string | null> {
  let token = readCookie("XSRF-TOKEN");
  if (!token) {
    await fetch("/api/auth/csrf", { credentials: "same-origin" });
    token = readCookie("XSRF-TOKEN");
  }
  return token;
}

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await send("POST", "/auth/refresh");
      return res.ok;
    } finally {
      // keep the promise around briefly so parallel 401s share one rotation
      setTimeout(() => (refreshing = null), 500);
    }
  })();
  return refreshing;
}

async function send(method: string, path: string, body?: BodyInit, json = false): Promise<Response> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (!SAFE_METHODS.has(method)) {
    const token = await csrfToken();
    if (token) headers["X-XSRF-TOKEN"] = token;
  }
  return fetch(`/api${path}`, { method, headers, body, credentials: "same-origin" });
}

async function parseError(res: Response): Promise<ApiError> {
  const fallback: Record<number, string> = { 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 429: "RATE_LIMITED" };
  let code = fallback[res.status] ?? "INTERNAL_ERROR";
  let fields: Record<string, string> | undefined;
  try {
    const data = await res.json();
    if (typeof data.code === "string") code = data.code;
    fields = data.fields;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, code, fields);
}

/** Guests and the public share pages have their own cookie and never go through the user refresh flow. */
const isSessionPath = (path: string) => !path.startsWith("/guest") && !path.startsWith("/share") && !path.startsWith("/invite") && (!path.startsWith("/auth/") || path === "/auth/me");

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await send(
      method,
      path,
      body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      body !== undefined && !isForm,
    );
  } catch (err) {
    log.error("API_NETWORK_ERROR", `${method} ${path}`, { reason: err instanceof Error ? err.message : "unknown" });
    throw new ApiError(0, "NETWORK");
  }

  if (res.status === 401 && retry && isSessionPath(path)) {
    log.debug("API_REFRESH", `${method} ${path} got 401, refreshing session`);
    if (await refreshSession()) return request<T>(method, path, body, false);
    log.warn("SESSION_EXPIRED", `refresh failed after ${method} ${path}`);
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  if (!res.ok) {
    const error = await parseError(res);
    // Not being logged in yet is normal on the login page; everything else deserves attention.
    const quiet = res.status === 401 && path === "/auth/me";
    (quiet ? log.debug : log.warn)("API_ERROR", `${method} ${path} -> ${res.status} ${error.code}`);
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Minimal typed client for the backend (`/api`). */
export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

let imageBase = "/api/images";

/** Guests load images through a separate, place-scoped endpoint. */
export function setImageBase(base: string) {
  imageBase = base;
}

/** URL of an image, honouring the current image base (user or guest). */
export const imageUrl = (id: string | null | undefined) => (id ? `${imageBase}/${id}` : undefined);
