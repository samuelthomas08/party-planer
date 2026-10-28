import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "@/lib/types";
import { renderApp } from "@/test/utils";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));

import { api } from "@/lib/api";
import { LiveLog } from "./LiveLog";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static CLOSED = 2;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  listeners = new Map<string, (e: MessageEvent) => void>();
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.set(type, cb);
  }
  close() {
    this.closed = true;
  }
  emit(entry: Partial<LogEntry>) {
    const full: LogEntry = {
      seq: Math.floor(Math.random() * 1e9), ts: "2026-10-28T09:30:00Z", level: "INFO", logger: "app.partyplaner.place.PlaceService",
      thread: "t", message: "hello", requestId: "req12345", user: "u-1", stack: null, ...entry,
    };
    this.listeners.get("log")!(new MessageEvent("log", { data: JSON.stringify(full) }));
  }
}

const source = () => FakeEventSource.instances.at(-1)!;
const flush = () => act(() => vi.advanceTimersByTime(300));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.mocked(api.get).mockResolvedValue({ level: "INFO" });
  vi.mocked(api.put).mockResolvedValue({ level: "DEBUG" });
  Element.prototype.scrollTo ??= () => {};
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LiveLog", () => {
  it("connects to the stream and shows the connection state", () => {
    renderApp(<LiveLog />);
    expect(source().url).toContain("/api/admin/logs/stream");
    expect(screen.getByRole("status")).toHaveTextContent("Getrennt");

    act(() => source().onopen?.());
    expect(screen.getByRole("status")).toHaveTextContent("Verbunden");
  });

  it("renders incoming lines with time, level, request id, user, short logger and message", () => {
    renderApp(<LiveLog />);
    act(() => source().emit({ message: "PLACE_CREATED owner=1" }));
    flush();

    const line = screen.getByText("PLACE_CREATED owner=1").closest("button")!;
    expect(line).toHaveTextContent("INFO");
    expect(line).toHaveTextContent("[req12345]");
    expect(line).toHaveTextContent("[u-1]");
    expect(line).toHaveTextContent("place.PlaceService");
    expect(line).not.toHaveTextContent("app.partyplaner.");
  });

  it("hides lines below the chosen minimum level and reveals them when it is lowered", async () => {
    renderApp(<LiveLog />);
    act(() => {
      source().emit({ level: "DEBUG", message: "debug noise" });
      source().emit({ level: "ERROR", message: "real problem" });
    });
    flush();

    expect(screen.queryByText("debug noise")).not.toBeInTheDocument();
    expect(screen.getByText("real problem")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Ab Level"), "DEBUG");
    expect(screen.getByText("debug noise")).toBeInTheDocument();
  });

  it("filters by text across message, logger, request id and user", async () => {
    renderApp(<LiveLog />);
    act(() => {
      source().emit({ message: "alpha event", requestId: "aaaa1111" });
      source().emit({ message: "beta event", requestId: "bbbb2222" });
    });
    flush();

    await userEvent.type(screen.getByLabelText("Suche"), "bbbb2222");

    expect(screen.queryByText("alpha event")).not.toBeInTheDocument();
    expect(screen.getByText("beta event")).toBeInTheDocument();
  });

  it("stops adding lines while paused and shows them after resuming", async () => {
    renderApp(<LiveLog />);
    await userEvent.click(screen.getByRole("button", { name: "Pausieren" }));

    act(() => source().emit({ message: "while paused" }));
    flush();
    expect(screen.queryByText("while paused")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Fortsetzen" }));
    flush();
    expect(screen.getByText("while paused")).toBeInTheDocument();
  });

  it("clears the view", async () => {
    renderApp(<LiveLog />);
    act(() => source().emit({ message: "to be cleared" }));
    flush();

    await userEvent.click(screen.getByRole("button", { name: "Leeren" }));

    expect(screen.queryByText("to be cleared")).not.toBeInTheDocument();
    expect(screen.getByText(/Noch keine Einträge/)).toBeInTheDocument();
  });

  it("expands a stack trace on click", async () => {
    renderApp(<LiveLog />);
    act(() => source().emit({ level: "ERROR", message: "boom", stack: "java.lang.IllegalStateException: x\n\tat Foo.bar" }));
    flush();

    expect(screen.queryByText(/IllegalStateException/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("boom"));
    expect(screen.getByText(/IllegalStateException/)).toBeInTheDocument();
  });

  it("shows the server's log level and changes it", async () => {
    renderApp(<LiveLog />);
    const select = await screen.findByLabelText("Server-Level");
    expect(select).toHaveValue("INFO");

    await userEvent.selectOptions(select, "DEBUG");

    expect(api.put).toHaveBeenCalledWith("/admin/logs/level", { level: "DEBUG" });
    expect(await screen.findByText("Log-Level: DEBUG")).toBeInTheDocument();
  });

  it("closes the stream when the page is left", () => {
    const { unmount } = renderApp(<LiveLog />);
    const es = source();

    unmount();

    expect(es.closed).toBe(true);
  });

  it("counts shown versus received lines", () => {
    renderApp(<LiveLog />);
    act(() => {
      source().emit({ level: "DEBUG", message: "d" });
      source().emit({ message: "i" });
    });
    flush();

    expect(screen.getByText("1 von 2 Zeilen")).toBeInTheDocument();
  });
});
