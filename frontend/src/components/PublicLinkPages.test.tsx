import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/utils";
import { router } from "@/test/mocks";

vi.mock("next/navigation", async () => {
  const mocks = await import("@/test/mocks");
  return { useRouter: () => mocks.router, useParams: () => ({ token: "secret-token" }) };
});
vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { ApiError, api } from "@/lib/api";
import { InviteAccept } from "./InviteAccept";
import { ShareLanding } from "./ShareLanding";

const expires = "2030-01-01T10:00:00Z";

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  router.push.mockClear();
  router.replace.mockClear();
});

describe("InviteAccept", () => {
  it("greets the invited person and asks for name, email and password", async () => {
    vi.mocked(api.get).mockResolvedValue({ email: null, invitedBy: "Ada", expiresAt: expires });
    renderApp(<InviteAccept />);

    expect(await screen.findByRole("heading", { name: "Willkommen beim Party Planer" })).toBeInTheDocument();
    expect(screen.getByText(/Ada hat dich eingeladen/)).toBeInTheDocument();
    expect(screen.getByLabelText("E-Mail")).not.toHaveAttribute("readonly");
    expect(api.get).toHaveBeenCalledWith("/invite/secret-token");
  });

  it("creates the account, signs in and goes to the dashboard", async () => {
    vi.mocked(api.get).mockResolvedValue({ email: null, invitedBy: "Ada", expiresAt: expires });
    vi.mocked(api.post).mockResolvedValue({ id: "u", email: "nina@example.com", displayName: "Nina", role: "USER" });
    const { queryClient } = renderApp(<InviteAccept />);

    await userEvent.type(await screen.findByLabelText("Name"), "Nina");
    await userEvent.type(screen.getByLabelText("E-Mail"), "nina@example.com");
    await userEvent.type(screen.getByLabelText("Passwort"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(api.post).toHaveBeenCalledWith("/invite/secret-token/accept", {
      email: "nina@example.com", displayName: "Nina", password: "a long enough password",
    });
    expect(queryClient.getQueryData(["me"])).toMatchObject({ displayName: "Nina" });
  });

  it("locks the address when the admin fixed it", async () => {
    vi.mocked(api.get).mockResolvedValue({ email: "fixed@example.com", invitedBy: "Ada", expiresAt: expires });
    vi.mocked(api.post).mockResolvedValue({ id: "u", email: "fixed@example.com", displayName: "N", role: "USER" });
    renderApp(<InviteAccept />);

    const email = await screen.findByLabelText("E-Mail");
    expect(email).toHaveValue("fixed@example.com");
    expect(email).toHaveAttribute("readonly");

    await userEvent.type(screen.getByLabelText("Name"), "N");
    await userEvent.type(screen.getByLabelText("Passwort"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ email: "fixed@example.com" });
  });

  it("shows a clear message for dead links", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, "INVITE_INVALID"));
    renderApp(<InviteAccept />);

    expect(await screen.findByRole("heading", { name: "Einladung ungültig" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Passwort")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anmelden" })).toHaveAttribute("href", "/login");
  });

  it("keeps the form and shows the reason when the address is taken", async () => {
    vi.mocked(api.get).mockResolvedValue({ email: null, invitedBy: "", expiresAt: expires });
    vi.mocked(api.post).mockRejectedValue(new ApiError(409, "EMAIL_TAKEN"));
    renderApp(<InviteAccept />);

    await userEvent.type(await screen.findByLabelText("Name"), "N");
    await userEvent.type(screen.getByLabelText("E-Mail"), "taken@example.com");
    await userEvent.type(screen.getByLabelText("Passwort"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Konto erstellen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("bereits registriert");
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("ShareLanding", () => {
  it("names the shared place and who shared it", async () => {
    vi.mocked(api.get).mockResolvedValue({ placeName: "Main hall", sharedBy: "Ada", expiresAt: null });
    renderApp(<ShareLanding />);

    expect(await screen.findByRole("heading", { name: "Main hall" })).toBeInTheDocument();
    expect(screen.getByText(/Ada hat diesen Ort mit dir geteilt/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/share/secret-token");
  });

  it("joins as a guest with the chosen name and opens the place", async () => {
    vi.mocked(api.get).mockResolvedValue({ placeName: "Main hall", sharedBy: "Ada", expiresAt: null });
    vi.mocked(api.post).mockResolvedValue({ name: "Gina", placeId: "p1" });
    renderApp(<ShareLanding />);

    await userEvent.type(await screen.findByLabelText("Dein Name"), "  Gina ");
    await userEvent.click(screen.getByRole("button", { name: "Als Gast fortfahren" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/guest"));
    expect(api.post).toHaveBeenCalledWith("/share/secret-token/guest", { name: "Gina" });
  });

  it("shows the link's expiry when it has one", async () => {
    vi.mocked(api.get).mockResolvedValue({ placeName: "Main hall", sharedBy: "", expiresAt: expires });
    renderApp(<ShareLanding />);

    expect(await screen.findByText(/Der Link gilt bis/)).toBeInTheDocument();
    expect(screen.getByText(/Dieser Ort wurde mit dir geteilt/)).toBeInTheDocument();
  });

  it("shows a dead-link page for revoked or expired links", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, "SHARE_INVALID"));
    renderApp(<ShareLanding />);

    expect(await screen.findByRole("heading", { name: "Link ungültig" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Als Gast fortfahren" })).not.toBeInTheDocument();
  });

  it("reports a failed join", async () => {
    vi.mocked(api.get).mockResolvedValue({ placeName: "Main hall", sharedBy: "", expiresAt: null });
    vi.mocked(api.post).mockRejectedValue(new ApiError(404, "SHARE_INVALID"));
    renderApp(<ShareLanding />);

    await userEvent.type(await screen.findByLabelText("Dein Name"), "Gina");
    await userEvent.click(screen.getByRole("button", { name: "Als Gast fortfahren" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("nicht mehr gültig");
    expect(router.push).not.toHaveBeenCalled();
  });
});
