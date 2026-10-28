import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser, Invitation } from "@/lib/types";
import { renderApp } from "@/test/utils";

vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { ApiError, api } from "@/lib/api";
import { UsersAdmin } from "./UsersAdmin";

const user = (over: Partial<AdminUser> = {}): AdminUser => ({
  id: "u-other", email: "nina@example.com", displayName: "Nina", role: "USER", enabled: true, locked: false,
  createdAt: "2026-01-02T10:00:00Z", places: 3, equipment: 5, ...over,
});

const me = { id: "u-me", email: "ada@example.com", displayName: "Ada", role: "ADMIN" };
let users: AdminUser[];
let invitations: Invitation[];

beforeEach(() => {
  users = [user({ id: "u-me", email: "ada@example.com", displayName: "Ada", role: "ADMIN" }), user()];
  invitations = [];
  vi.mocked(api.get).mockImplementation(async (path: string) =>
    path === "/auth/me" ? me : path === "/admin/users" ? users : path === "/admin/invitations" ? invitations : null,
  );
  vi.mocked(api.post).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.delete).mockReset();
});

async function openUser(name: string) {
  await userEvent.click((await screen.findByText(name)).closest("button")!);
  return within(await screen.findByRole("dialog"));
}

describe("UsersAdmin list", () => {
  it("shows every account with role, usage and status", async () => {
    users.push(user({ id: "u3", displayName: "Locky", email: "l@x.de", enabled: false, locked: true }));
    renderApp(<UsersAdmin />);

    expect(await screen.findByText("Nina")).toBeInTheDocument();
    expect(screen.getByText("nina@example.com")).toBeInTheDocument();
    expect(screen.getAllByText(/3 Orte · 5 Equipment/).length).toBeGreaterThan(0);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Deaktiviert")).toBeInTheDocument();
    expect(screen.getByText("Gesperrt")).toBeInTheDocument();
  });

  it("lists pending and past invitations", async () => {
    invitations = [
      { id: "i1", email: "new@x.de", role: "USER", status: "PENDING", createdAt: "2026-10-01T10:00:00Z", expiresAt: "2030-10-02T10:00:00Z" },
      { id: "i2", email: null, role: "ADMIN", status: "USED", createdAt: "2026-09-01T10:00:00Z", expiresAt: "2026-09-02T10:00:00Z" },
    ];
    renderApp(<UsersAdmin />);

    expect(await screen.findByText("new@x.de")).toBeInTheDocument();
    expect(screen.getByText("Offen")).toBeInTheDocument();
    expect(screen.getByText("Angenommen")).toBeInTheDocument();
    expect(screen.getByText("Beliebige E-Mail")).toBeInTheDocument();
  });

  it("revokes only pending invitations", async () => {
    invitations = [
      { id: "i1", email: "new@x.de", role: "USER", status: "PENDING", createdAt: "2026-10-01T10:00:00Z", expiresAt: "2030-10-02T10:00:00Z" },
      { id: "i2", email: "old@x.de", role: "USER", status: "USED", createdAt: "2026-09-01T10:00:00Z", expiresAt: "2026-09-02T10:00:00Z" },
    ];
    vi.mocked(api.delete).mockResolvedValue(undefined);
    renderApp(<UsersAdmin />);

    const buttons = await screen.findAllByRole("button", { name: "Einladung widerrufen" });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/admin/invitations/i1"));
  });
});

describe("UsersAdmin user dialog", () => {
  it("changes another user's role", async () => {
    vi.mocked(api.patch).mockResolvedValue({});
    renderApp(<UsersAdmin />);

    const dialog = await openUser("Nina");
    await userEvent.click(dialog.getByRole("tab", { name: "Admin" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/u-other", { role: "ADMIN" }));
  });

  it("does not let admins change, disable or delete themselves", async () => {
    renderApp(<UsersAdmin />);

    const dialog = await openUser("Ada");

    expect(dialog.getByText("Die eigene Rolle kann nicht geändert werden.")).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Konto deaktivieren" })).not.toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Nutzer löschen" })).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("tab", { name: "Nutzer" }));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("disables an account", async () => {
    vi.mocked(api.patch).mockResolvedValue({});
    renderApp(<UsersAdmin />);

    const dialog = await openUser("Nina");
    await userEvent.click(dialog.getByRole("button", { name: "Konto deaktivieren" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/u-other", { enabled: false }));
  });

  it("offers unlocking only for locked accounts", async () => {
    users[1] = user({ locked: true });
    vi.mocked(api.post).mockResolvedValue(undefined);
    renderApp(<UsersAdmin />);

    const dialog = await openUser("Nina");
    await userEvent.click(dialog.getByRole("button", { name: "Entsperren" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/users/u-other/unlock"));
  });

  it("resets a password", async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);
    renderApp(<UsersAdmin />);

    const dialog = await openUser("Nina");
    await userEvent.type(dialog.getByLabelText("Neues Passwort"), "a brand new password");
    await userEvent.click(dialog.getAllByRole("button", { name: "Passwort zurücksetzen" }).at(-1)!);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/users/u-other/password", { password: "a brand new password" }));
  });

  it("asks for confirmation, names the data that will be lost and then deletes", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);
    renderApp(<UsersAdmin />);

    const dialog = await openUser("Nina");
    await userEvent.click(dialog.getByRole("button", { name: "Nutzer löschen" }));

    expect(await screen.findByText(/wird samt 3 Orten und 5 Equipment endgültig gelöscht/)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();

    const dialogs = screen.getAllByRole("dialog");
    await userEvent.click(within(dialogs.at(-1)!).getByRole("button", { name: "Löschen" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/admin/users/u-other"));
  });

  it("shows why the last admin cannot be demoted", async () => {
    vi.mocked(api.patch).mockRejectedValue(new ApiError(409, "LAST_ADMIN"));
    users[1] = user({ role: "ADMIN" });
    renderApp(<UsersAdmin />);

    const dialog = await openUser("Nina");
    await userEvent.click(dialog.getByRole("tab", { name: "Nutzer" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("Der letzte Administrator kann nicht entfernt werden.");
  });
});

describe("InviteSheet", () => {
  async function createInvite(email?: string) {
    vi.mocked(api.post).mockResolvedValue({ id: "i1", token: "TOKEN-ABC", email: email ?? null, role: "USER", status: "PENDING", createdAt: "2026-10-28T10:00:00Z", expiresAt: "2026-11-04T10:00:00Z" });
    renderApp(<UsersAdmin />);
    await userEvent.click(await screen.findByRole("button", { name: "Einladen" }));
    const dialog = within(await screen.findByRole("dialog"));
    if (email) await userEvent.type(dialog.getByLabelText("E-Mail (optional)"), email);
    await userEvent.click(dialog.getByRole("button", { name: "Einladungslink erzeugen" }));
    return dialog;
  }

  it("creates an invitation with the chosen role and validity and shows the link once", async () => {
    const dialog = await createInvite();

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/invitations", { email: null, role: "USER", expiresInHours: 168 }));
    const link = await dialog.findByLabelText("Einladungslink");
    expect(link).toHaveValue(`${window.location.origin}/invite/TOKEN-ABC`);
    expect(dialog.getByText(/nur jetzt angezeigt/)).toBeInTheDocument();
  });

  it("fixes the address when one is typed in", async () => {
    await createInvite("fixed@example.com");

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/admin/invitations", { email: "fixed@example.com", role: "USER", expiresInHours: 168 }));
  });

  it("copies the link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const dialog = await createInvite();

    await userEvent.click(await dialog.findByRole("button", { name: "Kopieren" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/TOKEN-ABC`);
    expect(await dialog.findByRole("button", { name: "Kopiert" })).toBeInTheDocument();
  });

  it("explains refusals such as an address that already has an account", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(409, "EMAIL_TAKEN"));
    renderApp(<UsersAdmin />);
    await userEvent.click(await screen.findByRole("button", { name: "Einladen" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Einladungslink erzeugen" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("bereits registriert");
  });
});
