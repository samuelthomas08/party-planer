import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/utils";

vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { ApiError, api } from "@/lib/api";
import { ProfileSettings } from "./ProfileSettings";
import { SystemSettings } from "./SystemSettings";

const me = { id: "u1", email: "ada@example.com", displayName: "Ada", role: "ADMIN" };

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.put).mockReset();
});

describe("ProfileSettings", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue(me);
  });

  it("shows the account, with the email read-only", async () => {
    renderApp(<ProfileSettings />);

    expect(await screen.findByLabelText("E-Mail")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("E-Mail")).toBeDisabled();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada");
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("saves a new display name and updates the cached user", async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...me, displayName: "Ada L." });
    const { queryClient } = renderApp(<ProfileSettings />);

    const name = await screen.findByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Ada L.");
    await userEvent.click(screen.getAllByRole("button", { name: "Speichern" })[0]);

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/auth/profile", { displayName: "Ada L." }));
    await waitFor(() => expect(queryClient.getQueryData(["me"])).toMatchObject({ displayName: "Ada L." }));
  });

  it("changes the password, then clears the form", async () => {
    vi.mocked(api.post).mockResolvedValue({ ...me });
    renderApp(<ProfileSettings />);

    await userEvent.type(await screen.findByLabelText("Aktuelles Passwort"), "old password");
    await userEvent.type(screen.getByLabelText("Neues Passwort"), "a brand new password");
    await userEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/auth/password", { currentPassword: "old password", newPassword: "a brand new password" }));
    await waitFor(() => expect(screen.getByLabelText("Aktuelles Passwort")).toHaveValue(""));
  });

  it("says when the current password is wrong and keeps what was typed", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(403, "WRONG_PASSWORD"));
    renderApp(<ProfileSettings />);

    await userEvent.type(await screen.findByLabelText("Aktuelles Passwort"), "nope");
    await userEvent.type(screen.getByLabelText("Neues Passwort"), "a brand new password");
    await userEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Das aktuelle Passwort ist falsch.");
    expect(screen.getByLabelText("Aktuelles Passwort")).toHaveValue("nope");
  });
});

describe("SystemSettings", () => {
  it("shows whether registration is open and toggles it", async () => {
    vi.mocked(api.get).mockResolvedValue({ registrationEnabled: true });
    vi.mocked(api.put).mockResolvedValue({ registrationEnabled: false });
    renderApp(<SystemSettings />);

    const toggle = await screen.findByRole("switch", { name: "Registrierung erlauben" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(toggle);

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/admin/settings", { registrationEnabled: false }));
  });

  it("can switch registration back on", async () => {
    vi.mocked(api.get).mockResolvedValue({ registrationEnabled: false });
    vi.mocked(api.put).mockResolvedValue({ registrationEnabled: true });
    renderApp(<SystemSettings />);

    await userEvent.click(await screen.findByRole("switch"));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/admin/settings", { registrationEnabled: true }));
  });

  it("reports a failure to load", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(403, "FORBIDDEN"));
    renderApp(<SystemSettings />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Dazu fehlt die Berechtigung");
  });
});
