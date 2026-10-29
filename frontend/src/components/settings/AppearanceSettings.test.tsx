import { screen, waitFor } from "@testing-library/react";
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

import { setLocale } from "@/i18n/actions";
import { AppearanceSettings } from "./AppearanceSettings";

beforeEach(() => {
  router.refresh.mockClear();
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("AppearanceSettings", () => {
  it("changes the language through the server action and refreshes", async () => {
    renderApp(<AppearanceSettings />);

    await userEvent.click(screen.getByRole("tab", { name: "English" }));

    await waitFor(() => expect(setLocale).toHaveBeenCalledWith("en"));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("applies and remembers the chosen theme, and 'system' removes the override", async () => {
    renderApp(<AppearanceSettings />);

    await userEvent.click(screen.getByRole("tab", { name: "Dunkel" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("pp-theme")).toBe("dark");

    await userEvent.click(screen.getByRole("tab", { name: "Hell" }));
    expect(document.documentElement.dataset.theme).toBe("light");

    await userEvent.click(screen.getByRole("tab", { name: "System" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("pp-theme")).toBeNull();
  });

  it("starts with the theme that was applied before hydration", () => {
    document.documentElement.dataset.theme = "dark";
    renderApp(<AppearanceSettings />);

    expect(screen.getByRole("tab", { name: "Dunkel" })).toHaveAttribute("aria-selected", "true");
  });
});
