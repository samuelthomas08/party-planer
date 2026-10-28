import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/utils";
import { router } from "@/test/mocks";

vi.mock("next/navigation", async () => {
  const mocks = await import("@/test/mocks");
  return { useRouter: () => mocks.router };
});
vi.mock("@/i18n/actions", () => ({ setLocale: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { setLocale } from "@/i18n/actions";
import { ApiError, AUTH_EXPIRED_EVENT, api } from "@/lib/api";
import { AppShell } from "./AppShell";

const me = { id: "u1", email: "ada@example.com", displayName: "Ada Lovelace", role: "USER" };

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  router.replace.mockClear();
  router.refresh.mockClear();
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("AppShell", () => {
  it("shows a spinner and none of the page while the session is being checked", () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderApp(<AppShell><p>private page</p></AppShell>);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("private page")).not.toBeInTheDocument();
  });

  it("renders the page with header and account initials once signed in", async () => {
    vi.mocked(api.get).mockResolvedValue(me);
    renderApp(<AppShell><p>private page</p></AppShell>);

    expect(await screen.findByText("private page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Konto-Menü" })).toHaveTextContent("AL");
    expect(screen.getByRole("link", { name: "Party Planer" })).toHaveAttribute("href", "/");
  });

  it("sends visitors without a session to the login page", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(401, "UNAUTHENTICATED"));
    renderApp(<AppShell><p>private page</p></AppShell>);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("private page")).not.toBeInTheDocument();
  });

  it("does not redirect for other errors such as an unreachable server", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(500, "INTERNAL_ERROR"));
    renderApp(<AppShell><p>private page</p></AppShell>);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("leaves for the login page and forgets cached data when the session expires mid-use", async () => {
    vi.mocked(api.get).mockResolvedValue(me);
    const { queryClient } = renderApp(<AppShell><p>private page</p></AppShell>);
    await screen.findByText("private page");
    queryClient.setQueryData(["folders"], [{ id: "secret" }]);

    act(() => window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT)));

    expect(router.replace).toHaveBeenCalledWith("/login");
    expect(queryClient.getQueryData(["folders"])).toBeUndefined();
  });
});

describe("UserMenu", () => {
  async function openMenu() {
    vi.mocked(api.get).mockResolvedValue(me);
    renderApp(<AppShell><p>x</p></AppShell>);
    await userEvent.click(await screen.findByRole("button", { name: "Konto-Menü" }));
  }

  it("shows who is signed in and links to the settings", async () => {
    await openMenu();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Einstellungen" })).toHaveAttribute("href", "/settings");
  });

  it("closes with Escape and when clicking elsewhere", async () => {
    await openMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Konto-Menü" }));
    await userEvent.click(screen.getByText("x"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("logs out on the server, forgets cached data and goes to the login page", async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);
    await openMenu();

    await userEvent.click(screen.getByRole("menuitem", { name: "Abmelden" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(api.post).toHaveBeenCalledWith("/auth/logout");
  });

  it("still leaves the app when the logout request fails", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(0, "NETWORK"));
    await openMenu();

    await userEvent.click(screen.getByRole("menuitem", { name: "Abmelden" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  });

  it("changes the language through the server action and refreshes", async () => {
    await openMenu();

    await userEvent.click(screen.getByRole("button", { name: "en" }));

    await waitFor(() => expect(setLocale).toHaveBeenCalledWith("en"));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("applies and remembers the chosen theme, and 'system' removes the override", async () => {
    await openMenu();

    await userEvent.click(screen.getByRole("button", { name: "Dunkel" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("pp-theme")).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: "Hell" }));
    expect(document.documentElement.dataset.theme).toBe("light");

    await userEvent.click(screen.getByRole("button", { name: "System" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("pp-theme")).toBeNull();
  });
});
