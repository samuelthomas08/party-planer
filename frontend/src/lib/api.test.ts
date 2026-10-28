import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FetchMock = ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const empty = (status = 204) => new Response(null, { status });

async function load() {
  vi.resetModules();
  return import("./api");
}

let fetchMock: FetchMock;

beforeEach(() => {
  document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Awaits a promise that is expected to reject and returns the error. */
async function caught(promise: Promise<unknown>) {
  return (await promise.then(
    () => {
      throw new Error("expected the request to fail");
    },
    (e: unknown) => e,
  )) as { status: number; code: string; fields?: Record<string, string> };
}

const callsTo = (path: string) => fetchMock.mock.calls.filter(([url]) => url === path);

describe("api client", () => {
  it("sends GET requests without a CSRF header", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValueOnce(json([{ id: 1 }]));

    await expect(api.get("/folders")).resolves.toEqual([{ id: 1 }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/folders");
    expect(init.method).toBe("GET");
    expect(init.headers["X-XSRF-TOKEN"]).toBeUndefined();
    expect(init.credentials).toBe("same-origin");
  });

  it("echoes the XSRF cookie in a header on state-changing requests", async () => {
    document.cookie = "XSRF-TOKEN=abc123; path=/";
    const { api } = await load();
    fetchMock.mockResolvedValueOnce(json({ ok: true }));

    await api.post("/folders", { name: "Hall" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-XSRF-TOKEN"]).toBe("abc123");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Hall" }));
  });

  it("fetches a CSRF token first when none exists yet", async () => {
    const { api } = await load();
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/auth/csrf") {
        document.cookie = "XSRF-TOKEN=fresh; path=/";
        return empty();
      }
      return json({});
    });

    await api.post("/folders", {});

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/csrf");
    expect(fetchMock.mock.calls[1][1].headers["X-XSRF-TOKEN"]).toBe("fresh");
  });

  it("uploads FormData without forcing a JSON content type", async () => {
    document.cookie = "XSRF-TOKEN=t; path=/";
    const { api } = await load();
    fetchMock.mockResolvedValueOnce(json({ id: "img" }));
    const form = new FormData();
    form.append("file", new Blob(["x"]), "a.png");

    await api.post("/images", form);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("returns undefined for 204 responses", async () => {
    document.cookie = "XSRF-TOKEN=t; path=/";
    const { api } = await load();
    fetchMock.mockResolvedValueOnce(empty());

    await expect(api.delete("/folders/1")).resolves.toBeUndefined();
  });

  it("turns error responses into ApiError with code and field errors", async () => {
    const { api, ApiError } = await load();
    fetchMock.mockResolvedValueOnce(json({ code: "VALIDATION_FAILED", fields: { email: "bad" } }, 400));

    const error = await caught(api.get("/x"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fields).toEqual({ email: "bad" });
  });

  it.each([[403, "FORBIDDEN"], [404, "NOT_FOUND"], [429, "RATE_LIMITED"], [500, "INTERNAL_ERROR"]])(
    "falls back to a sensible code for an empty %i response",
    async (status, code) => {
      const { api } = await load();
      fetchMock.mockResolvedValueOnce(new Response("", { status }));

      const error = await caught(api.get("/x"));

      expect(error.code).toBe(code);
    },
  );

  it("reports connectivity problems as NETWORK", async () => {
    const { api } = await load();
    fetchMock.mockRejectedValueOnce(new TypeError("failed to fetch"));

    const error = await caught(api.get("/folders"));

    expect(error.code).toBe("NETWORK");
    expect(error.status).toBe(0);
  });

  describe("session refresh", () => {
    it("refreshes once on 401 and retries the original request", async () => {
      document.cookie = "XSRF-TOKEN=t; path=/";
      const { api } = await load();
      fetchMock
        .mockResolvedValueOnce(json({ code: "UNAUTHENTICATED" }, 401))
        .mockResolvedValueOnce(json({ id: "u" })) // POST /auth/refresh
        .mockResolvedValueOnce(json([1, 2, 3])); // retry

      await expect(api.get("/folders")).resolves.toEqual([1, 2, 3]);

      expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(["/api/folders", "/api/auth/refresh", "/api/folders"]);
    });

    it("lets parallel 401s share a single refresh", async () => {
      document.cookie = "XSRF-TOKEN=t; path=/";
      const { api } = await load();
      let refreshes = 0;
      const answered = new Set<string>();
      fetchMock.mockImplementation(async (url: string) => {
        if (url === "/api/auth/refresh") {
          refreshes++;
          return json({});
        }
        if (!answered.has(url)) {
          answered.add(url);
          return json({}, 401);
        }
        return json({ ok: url });
      });

      await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);

      expect(refreshes).toBe(1);
    });

    it("announces an expired session when the refresh fails", async () => {
      document.cookie = "XSRF-TOKEN=t; path=/";
      const { api, AUTH_EXPIRED_EVENT, ApiError } = await load();
      const listener = vi.fn();
      window.addEventListener(AUTH_EXPIRED_EVENT, listener);
      fetchMock.mockResolvedValue(json({ code: "UNAUTHENTICATED" }, 401));

      const error = await caught(api.get("/folders"));

      expect(error).toBeInstanceOf(ApiError);
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
    });

    it("never tries to refresh for login, guest, share or invite requests", async () => {
      document.cookie = "XSRF-TOKEN=t; path=/";
      const { api } = await load();
      fetchMock.mockImplementation(async () => json({ code: "INVALID_CREDENTIALS" }, 401));

      await api.post("/auth/login", {}).catch(() => {});
      await api.get("/guest/place").catch(() => {});
      await api.get("/share/abc").catch(() => {});
      await api.get("/invite/abc").catch(() => {});

      expect(callsTo("/api/auth/refresh")).toHaveLength(0);
    });

    it("does refresh for /auth/me so a returning visitor stays signed in", async () => {
      const { api } = await load();
      fetchMock
        .mockResolvedValueOnce(json({}, 401))
        .mockResolvedValueOnce(json({}))
        .mockResolvedValueOnce(json({ email: "a@b.de" }));
      document.cookie = "XSRF-TOKEN=t; path=/";

      await expect(api.get("/auth/me")).resolves.toEqual({ email: "a@b.de" });
    });
  });

  describe("imageUrl", () => {
    it("builds user image urls by default and guest urls after switching", async () => {
      const { imageUrl, setImageBase } = await load();

      expect(imageUrl("abc")).toBe("/api/images/abc");
      setImageBase("/api/guest/images");
      expect(imageUrl("abc")).toBe("/api/guest/images/abc");
    });

    it("returns undefined for missing ids", async () => {
      const { imageUrl } = await load();

      expect(imageUrl(null)).toBeUndefined();
      expect(imageUrl(undefined)).toBeUndefined();
    });
  });
});
