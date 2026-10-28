import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/utils";
import { router } from "@/test/mocks";

vi.mock("next/navigation", async () => {
  const mocks = await import("@/test/mocks");
  return { useRouter: () => mocks.router };
});
vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { ApiError, api } from "@/lib/api";
import { AuthForm } from "./AuthForm";

const user = { id: "u1", email: "ada@example.com", displayName: "Ada", role: "ADMIN" as const };

beforeEach(() => {
  vi.mocked(api.get).mockRejectedValue(new ApiError(401, "UNAUTHENTICATED"));
  vi.mocked(api.post).mockReset();
  router.replace.mockClear();
});

describe("AuthForm (login)", () => {
  it("shows the login texts and a link to registration", () => {
    renderApp(<AuthForm mode="login" />);
    expect(screen.getByRole("heading", { name: "Willkommen zurück" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Registrieren" })).toHaveAttribute("href", "/register");
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("signs in with the entered credentials and goes to the dashboard", async () => {
    vi.mocked(api.post).mockResolvedValue(user);
    const { queryClient } = renderApp(<AuthForm mode="login" />);

    await userEvent.type(screen.getByLabelText("E-Mail"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Passwort"), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(api.post).toHaveBeenCalledWith("/auth/login", { email: "ada@example.com", password: "correct horse battery" });
    expect(queryClient.getQueryData(["me"])).toEqual(user);
  });

  it("shows a translated, generic error for wrong credentials and stays on the page", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS"));
    renderApp(<AuthForm mode="login" />);

    await userEvent.type(screen.getByLabelText("E-Mail"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Passwort"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-Mail oder Passwort ist falsch.");
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeEnabled();
  });

  it("explains rate limiting", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(429, "RATE_LIMITED"));
    renderApp(<AuthForm mode="login" />);

    await userEvent.type(screen.getByLabelText("E-Mail"), "a@b.de");
    await userEvent.type(screen.getByLabelText("Passwort"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Zu viele Versuche");
  });

  it("skips the form for visitors who are already signed in", async () => {
    vi.mocked(api.get).mockResolvedValue(user);
    renderApp(<AuthForm mode="login" />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("speaks English when asked to", () => {
    renderApp(<AuthForm mode="login" />, { locale: "en" });
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });
});

describe("AuthForm (register)", () => {
  it("asks for a name too and requires a long password", () => {
    renderApp(<AuthForm mode="register" />);
    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Passwort")).toHaveAttribute("minlength", "10");
    expect(screen.getByText("Mindestens 10 Zeichen.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anmelden" })).toHaveAttribute("href", "/login");
  });

  it("creates the account and signs in", async () => {
    vi.mocked(api.post).mockResolvedValue(user);
    renderApp(<AuthForm mode="register" />);

    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    await userEvent.type(screen.getByLabelText("E-Mail"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Passwort"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Registrieren" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(api.post).toHaveBeenCalledWith("/auth/register", { email: "ada@example.com", password: "a long enough password", displayName: "Ada" });
  });

  it("shows server-side field errors next to the fields", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(400, "VALIDATION_FAILED", { password: "PASSWORD_LENGTH" }));
    renderApp(<AuthForm mode="register" />);

    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    await userEvent.type(screen.getByLabelText("E-Mail"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Passwort"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Registrieren" }));

    expect(await screen.findByText("Das Passwort muss mindestens 10 Zeichen lang sein.")).toBeInTheDocument();
  });

  it("reports a taken address", async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(409, "EMAIL_TAKEN"));
    renderApp(<AuthForm mode="register" />);

    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    await userEvent.type(screen.getByLabelText("E-Mail"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Passwort"), "a long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Registrieren" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("bereits registriert");
  });
});
