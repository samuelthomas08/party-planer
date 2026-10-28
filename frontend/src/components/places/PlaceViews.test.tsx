import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Equipment, Place, ShareLink } from "@/lib/types";
import { renderApp } from "@/test/utils";
import { router } from "@/test/mocks";

vi.mock("next/navigation", async () => {
  const mocks = await import("@/test/mocks");
  return { useRouter: () => mocks.router, useParams: () => ({ id: "p1" }), usePathname: () => "/" };
});
vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { ApiError, api, imageUrl } from "@/lib/api";
import { EditPlaceView } from "./EditPlaceView";
import { GuestPlaceView } from "./GuestPlaceView";
import { PlaceView } from "./PlaceView";
import { PlaceViewer } from "./PlaceViewer";
import { ShareSheet } from "./ShareSheet";

const equipment: Equipment[] = [
  { id: "e1", title: "Truss", description: "Heavy truss", category: "STAND", images: { FOOT: "foot1" } },
];
const place: Place = {
  id: "p1", name: "Main hall", folderId: "f1", floorPlanImageId: "plan1",
  placements: [
    { id: "m1", x: 0.2, y: 0.3, equipmentId: "e1", color: "#5672e4" },
    { id: "m2", x: 0.7, y: 0.6, equipmentId: null, color: "#f59e0b" },
  ],
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.delete).mockReset();
  router.replace.mockClear();
});

describe("PlaceViewer", () => {
  it("shows an empty hint when the place has no markers", () => {
    renderApp(<PlaceViewer place={{ ...place, placements: [] }} equipment={equipment} />);

    expect(screen.getByText("Noch keine Markierungen")).toBeInTheDocument();
  });

  it("lets the reader open a marker and shows its equipment", async () => {
    renderApp(<PlaceViewer place={place} equipment={equipment} />);
    expect(screen.getByText("Aktuell ist kein Equipment ausgewählt.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Markierung 1" }));

    const panel = within(screen.getByRole("complementary", { name: "Markierung 1" }));
    expect(panel.getByRole("heading", { name: "Truss" })).toBeInTheDocument();
    expect(panel.getByText("Heavy truss")).toBeInTheDocument();
  });

  it("also opens markers from the legend and closes the panel again", async () => {
    renderApp(<PlaceViewer place={place} equipment={equipment} />);

    await userEvent.click(within(screen.getByRole("list", { name: "Markierungen" })).getByRole("button", { name: /Kein Equipment zugewiesen/ }));
    expect(screen.getByRole("complementary", { name: "Markierung 2" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

describe("PlaceView (owner)", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (path: string) =>
      path === "/places/p1" ? place : path === "/equipment" ? equipment : path === "/places/p1/shares" ? [] : null,
    );
  });

  it("offers edit, history and share", async () => {
    renderApp(<PlaceView />);

    expect(await screen.findByRole("heading", { name: "Main hall" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bearbeiten" })).toHaveAttribute("href", "/places/p1/edit");
    expect(screen.getByRole("link", { name: "Verlauf" })).toHaveAttribute("href", "/places/p1/activity");
    expect(screen.getByRole("link", { name: "Zurück" })).toHaveAttribute("href", "/");
  });

  it("opens the share dialog", async () => {
    renderApp(<PlaceView />);

    await userEvent.click(await screen.findByRole("button", { name: /Teilen/ }));

    expect(await screen.findByRole("heading", { name: "Ort teilen" })).toBeInTheDocument();
  });

  it("explains a missing place", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, "NOT_FOUND"));
    renderApp(<PlaceView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("nicht gefunden");
  });
});

describe("EditPlaceView", () => {
  it("loads the place into the form", async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) => (path === "/places/p1" ? place : path === "/folders" ? [{ id: "f1", name: "Hall", places: [] }] : []));
    renderApp(<EditPlaceView />);

    expect(await screen.findByLabelText("Name des Ortes")).toHaveValue("Main hall");
    expect(screen.getByRole("link", { name: "Zurück" })).toHaveAttribute("href", "/places/p1");
  });

  it("shows the error when the place cannot be loaded", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, "NOT_FOUND"));
    renderApp(<EditPlaceView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("nicht gefunden");
  });
});

describe("GuestPlaceView", () => {
  const guestPlace = { guestName: "Gina", place, equipment };

  it("shows the shared place read-only, with the guest's name, and switches images to the guest endpoint", async () => {
    vi.mocked(api.get).mockResolvedValue(guestPlace);
    renderApp(<GuestPlaceView />);

    expect(await screen.findByRole("heading", { name: "Main hall" })).toBeInTheDocument();
    expect(screen.getByText("Gast")).toBeInTheDocument();
    expect(screen.getByText("Gina")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/guest/place");
    expect(imageUrl("plan1")).toBe("/api/guest/images/plan1");
    expect(screen.getByAltText("Main hall")).toHaveAttribute("src", "/api/guest/images/plan1");
    expect(screen.queryByRole("link", { name: "Bearbeiten" })).not.toBeInTheDocument();
  });

  it("lets guests look at equipment details", async () => {
    vi.mocked(api.get).mockResolvedValue(guestPlace);
    renderApp(<GuestPlaceView />);

    await userEvent.click(await screen.findByRole("button", { name: "Markierung 1" }));

    expect(screen.getByText("Heavy truss")).toBeInTheDocument();
  });

  it("shows the dead-link page once the share was revoked", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(401, "SHARE_INVALID"));
    renderApp(<GuestPlaceView />);

    expect(await screen.findByRole("heading", { name: "Link ungültig" })).toBeInTheDocument();
    expect(screen.getByText("Dieser Link ist nicht mehr gültig.")).toBeInTheDocument();
  });

  it("leaves the guest session", async () => {
    vi.mocked(api.get).mockResolvedValue(guestPlace);
    vi.mocked(api.post).mockResolvedValue(undefined);
    renderApp(<GuestPlaceView />);

    await userEvent.click(await screen.findByRole("button", { name: /Verlassen/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/guest/logout"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  });
});

describe("ShareSheet", () => {
  const link = (over: Partial<ShareLink> = {}): ShareLink => ({
    id: "s1", token: "TOKEN123", createdAt: "2026-10-01T10:00:00Z", expiresAt: "2030-10-08T10:00:00Z", revokedAt: null, active: true, ...over,
  });
  let links: ShareLink[];

  function setup() {
    vi.mocked(api.get).mockImplementation(async () => links);
    return renderApp(<ShareSheet placeId="p1" placeName="Main hall" open onClose={() => {}} />);
  }

  beforeEach(() => {
    links = [];
  });

  it("explains that nothing has been shared yet", async () => {
    setup();
    expect(await screen.findByText("Noch keine Links erzeugt.")).toBeInTheDocument();
  });

  it("creates a link with the chosen validity (7 days by default, 'never' sends null)", async () => {
    vi.mocked(api.post).mockResolvedValue(link());
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Link erzeugen" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/places/p1/shares", { expiresInHours: 168 }));

    await userEvent.selectOptions(screen.getByLabelText("Gültig für"), "never");
    await userEvent.click(screen.getByRole("button", { name: "Link erzeugen" }));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith("/places/p1/shares", { expiresInHours: null }));
  });

  it("shows active links with their full address and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    links = [link()];
    setup();

    const field = await screen.findByLabelText("Link zum Ort");
    expect(field).toHaveValue(`${window.location.origin}/share/TOKEN123`);
    await userEvent.click(screen.getByRole("button", { name: "Kopieren" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share/TOKEN123`);
    expect(await screen.findByRole("button", { name: "Kopiert" })).toBeInTheDocument();
  });

  it("revokes a link", async () => {
    links = [link()];
    vi.mocked(api.delete).mockResolvedValue(undefined);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Link widerrufen" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/places/p1/shares/s1"));
  });

  it("does not show an address for revoked or expired links", async () => {
    links = [link({ id: "s2", active: false, revokedAt: "2026-10-02T10:00:00Z" }), link({ id: "s3", active: false, expiresAt: "2026-10-03T10:00:00Z" })];
    setup();

    expect(await screen.findByText("Widerrufen")).toBeInTheDocument();
    expect(screen.getByText("Abgelaufen")).toBeInTheDocument();
    expect(screen.queryByLabelText("Link zum Ort")).not.toBeInTheDocument();
  });

  it("marks links without expiry", async () => {
    links = [link({ expiresAt: null })];
    setup();

    expect(await screen.findByText("unbegrenzt gültig")).toBeInTheDocument();
  });
});
