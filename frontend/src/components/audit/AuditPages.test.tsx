import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry, Page } from "@/lib/types";
import { renderApp } from "@/test/utils";
import { router } from "@/test/mocks";

let searchParams = new URLSearchParams();
vi.mock("next/navigation", async () => {
  const mocks = await import("@/test/mocks");
  return { useRouter: () => mocks.router, useParams: () => ({ id: "p1" }), useSearchParams: () => searchParams };
});
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { ApiError, api } from "@/lib/api";
import { PlaceActivityView } from "@/components/places/PlaceActivityView";
import { AuditAdmin } from "@/components/settings/AuditAdmin";

const entry = (id: string, over: Partial<AuditEntry> = {}): AuditEntry => ({
  id, at: "2026-10-28T09:30:00Z", actorName: "Ada", actorType: "USER", action: "PLACE_UPDATED", entityType: "PLACE",
  entityName: "Main hall", placeId: "p1", placeName: "Main hall", changes: [], ip: "10.0.0.1", ...over,
});
const page = (items: AuditEntry[], p = 0, totalPages = 1): Page<AuditEntry> => ({ items, page: p, totalPages, total: items.length });

beforeEach(() => {
  searchParams = new URLSearchParams();
  vi.mocked(api.get).mockReset();
  router.replace.mockClear();
});

describe("AuditAdmin", () => {
  function mock(auditPage: Page<AuditEntry>) {
    vi.mocked(api.get).mockImplementation(async (path: string) =>
      path.startsWith("/admin/audit") ? auditPage
        : path === "/admin/places" ? [{ id: "p1", name: "Main hall", folderName: "Hall", ownerName: "Ada" }]
        : null,
    );
  }

  it("shows the complete log including IP addresses", async () => {
    mock(page([entry("a"), entry("b", { action: "LOGIN", entityType: "USER", placeId: null, placeName: null })]));
    renderApp(<AuditAdmin />);

    expect(await screen.findByText("Ort „Main hall“ geändert")).toBeInTheDocument();
    expect(screen.getByText("Angemeldet")).toBeInTheDocument();
    expect(screen.getAllByText("IP 10.0.0.1")).toHaveLength(2);
    expect(api.get).toHaveBeenCalledWith("/admin/audit?page=0&size=25");
  });

  it("offers every place as a filter and navigates when one is chosen", async () => {
    mock(page([entry("a")]));
    renderApp(<AuditAdmin />);

    await screen.findByRole("option", { name: "Main hall (Ada)" }); // the place list loads asynchronously
    await userEvent.selectOptions(screen.getByLabelText("Nach Ort filtern"), "p1");

    expect(router.replace).toHaveBeenCalledWith("/settings/audit?place=p1");
  });

  it("filters by the place in the address", async () => {
    searchParams = new URLSearchParams("place=p1");
    mock(page([entry("a")]));
    renderApp(<AuditAdmin />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/admin/audit?page=0&size=25&placeId=p1"));
  });

  it("jumps to a place's history when its name is clicked", async () => {
    mock(page([entry("a")]));
    renderApp(<AuditAdmin />);

    await userEvent.click(await screen.findByRole("button", { name: "Main hall" }));

    expect(router.replace).toHaveBeenCalledWith("/settings/audit?place=p1");
  });

  it("pages through older entries", async () => {
    mock(page([entry("a")], 0, 3));
    renderApp(<AuditAdmin />);

    await userEvent.click(await screen.findByRole("button", { name: /Älter/ }));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/admin/audit?page=1&size=25"));
  });

  it("reports failures", async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path.startsWith("/admin/audit")) throw new ApiError(403, "FORBIDDEN");
      return [];
    });
    renderApp(<AuditAdmin />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Dazu fehlt die Berechtigung");
  });
});

describe("PlaceActivityView", () => {
  it("shows one place's history without IP addresses for normal users", async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) =>
      path === "/auth/me" ? { id: "u", email: "a@b.de", displayName: "A", role: "USER" } : page([entry("a")]),
    );
    renderApp(<PlaceActivityView />);

    expect(await screen.findByText("Ort „Main hall“ geändert")).toBeInTheDocument();
    expect(screen.queryByText(/IP 10/)).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/places/p1/activity?page=0&size=25");
    expect(screen.getByRole("link", { name: "Zurück" })).toHaveAttribute("href", "/places/p1");
  });

  it("shows IP addresses to admins", async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) =>
      path === "/auth/me" ? { id: "u", email: "a@b.de", displayName: "A", role: "ADMIN" } : page([entry("a")]),
    );
    renderApp(<PlaceActivityView />);

    expect(await screen.findByText("IP 10.0.0.1")).toBeInTheDocument();
  });

  it("reports a place the user may not see", async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { id: "u", email: "a@b.de", displayName: "A", role: "USER" };
      throw new ApiError(404, "NOT_FOUND");
    });
    renderApp(<PlaceActivityView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("nicht gefunden");
  });
});
