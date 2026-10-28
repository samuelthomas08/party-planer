import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let fetchMock: ReturnType<typeof vi.fn>;

async function load() {
  vi.resetModules();
  return import("./logger");
}

function sentEntries(call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body).entries as Array<Record<string, string>>;
}

beforeEach(() => {
  vi.useFakeTimers();
  document.cookie = "XSRF-TOKEN=tok; path=/";
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
});

describe("logger", () => {
  it("always writes to the console", async () => {
    const { log } = await load();

    log.info("EVT", "hello");
    log.warn("EVT", "careful");
    log.error("EVT", "broken");
    log.debug("EVT", "detail");

    expect(console.info).toHaveBeenCalledWith("[EVT] hello");
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(console.debug).toHaveBeenCalled();
  });

  it("keeps debug messages local", async () => {
    const { log } = await load();

    log.debug("EVT", "noise");
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("batches info messages and ships them after two seconds with the CSRF header", async () => {
    const { log } = await load();

    log.info("A", "one", { n: 1 });
    log.warn("B", "two");
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2100);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/client-logs");
    expect(init.headers["X-XSRF-TOKEN"]).toBe("tok");
    expect(sentEntries()).toMatchObject([
      { level: "info", event: "A", message: "one", data: '{"n":1}' },
      { level: "warn", event: "B", message: "two" },
    ]);
  });

  it("ships errors immediately", async () => {
    const { log } = await load();

    log.error("BOOM", "it broke");
    await vi.advanceTimersByTimeAsync(10);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentEntries()[0]).toMatchObject({ level: "error", event: "BOOM" });
  });

  it("truncates oversized messages and data to what the server accepts", async () => {
    const { log } = await load();

    log.info("BIG", "m".repeat(2000), { blob: "d".repeat(2000) });
    await vi.advanceTimersByTimeAsync(2100);

    const [entry] = sentEntries();
    expect(entry.message.length).toBeLessThanOrEqual(590);
    expect(entry.data.length).toBeLessThanOrEqual(590);
  });

  it("does not try to send when the user is not signed in (no CSRF cookie)", async () => {
    document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
    const { log } = await load();

    log.info("EARLY", "before login");
    await vi.advanceTimersByTimeAsync(2100);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("backs off for a minute after the server refuses logs (guests, expired sessions)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const { log } = await load();

    log.info("A", "first");
    await vi.advanceTimersByTimeAsync(2100);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    log.info("B", "second");
    await vi.advanceTimersByTimeAsync(2100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("survives network failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { log } = await load();

    log.error("X", "y");
    await vi.advanceTimersByTimeAsync(50);

    expect(console.error).toHaveBeenCalled();
  });

  it("reports uncaught errors and unhandled rejections once installed", async () => {
    const { installGlobalLogging, log } = await load();
    void log;

    installGlobalLogging();
    installGlobalLogging(); // idempotent
    window.dispatchEvent(new ErrorEvent("error", { message: "kaboom", filename: "app.js", lineno: 7 }));
    const rejection = new Event("unhandledrejection") as Event & { reason: unknown };
    rejection.reason = new Error("nope");
    window.dispatchEvent(rejection);
    await vi.advanceTimersByTimeAsync(50);

    const messages = fetchMock.mock.calls.flatMap((_, i) => sentEntries(i)).map((e) => `${e.event}:${e.message}`);
    expect(messages).toContain("UNCAUGHT_ERROR:kaboom");
    expect(messages).toContain("UNHANDLED_REJECTION:nope");
    expect(messages.filter((m) => m.startsWith("APP_START"))).toHaveLength(1);
  });
});
