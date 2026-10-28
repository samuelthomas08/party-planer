import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/utils";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings/users" }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { api } from "@/lib/api";
import { AdminOnly } from "./AdminOnly";
import { SettingsNav } from "./SettingsNav";

const me = (role: "USER" | "ADMIN") => ({ id: "u", email: "a@b.de", displayName: "A", role });

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

describe("SettingsNav", () => {
  it("shows every section to admins and marks the current one", async () => {
    vi.mocked(api.get).mockResolvedValue(me("ADMIN"));
    renderApp(<SettingsNav />);

    expect(await screen.findByRole("link", { name: "Nutzer" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Profil" })).not.toHaveAttribute("aria-current");
  });

  it("shows only the profile to normal users", async () => {
    vi.mocked(api.get).mockResolvedValue(me("USER"));
    renderApp(<SettingsNav />);

    expect(await screen.findByRole("link", { name: "Profil" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("AdminOnly", () => {
  it("renders the page for admins", async () => {
    vi.mocked(api.get).mockResolvedValue(me("ADMIN"));
    renderApp(<AdminOnly><p>secret admin page</p></AdminOnly>);

    expect(await screen.findByText("secret admin page")).toBeInTheDocument();
  });

  it("hides the page from normal users", async () => {
    vi.mocked(api.get).mockResolvedValue(me("USER"));
    renderApp(<AdminOnly><p>secret admin page</p></AdminOnly>);

    expect(await screen.findByRole("alert")).toHaveTextContent("Dazu fehlt die Berechtigung");
    expect(screen.queryByText("secret admin page")).not.toBeInTheDocument();
  });

  it("hides the page while the user is still unknown", () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderApp(<AdminOnly><p>secret admin page</p></AdminOnly>);

    expect(screen.queryByText("secret admin page")).not.toBeInTheDocument();
  });
});
