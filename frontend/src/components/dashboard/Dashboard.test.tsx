import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Equipment, Folder } from "@/lib/types";
import { renderApp } from "@/test/utils";

vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import { ApiError, api } from "@/lib/api";
import { Dashboard } from "./Dashboard";
import { EquipmentSection } from "./EquipmentSection";
import { PlacesSection } from "./PlacesSection";

let folders: Folder[];
let equipment: Equipment[];

beforeEach(() => {
  folders = [
    { id: "f1", name: "Hall", places: [{ id: "p1", name: "Main hall", folderId: "f1", floorPlanImageId: "plan1" }, { id: "p2", name: "Cellar", folderId: "f1", floorPlanImageId: null }] },
    { id: "f2", name: "Garden", places: [] },
  ];
  equipment = [
    { id: "e1", title: "Truss", description: "", category: "STAND", images: { FOOT: "foot1" } },
    { id: "e2", title: "Fog machine", description: "", category: "OTHER", images: { PHOTO: "photo1" } },
  ];
  vi.mocked(api.get).mockImplementation(async (path: string) => (path === "/folders" ? folders : path === "/equipment" ? equipment : null));
  vi.mocked(api.post).mockReset();
  vi.mocked(api.patch).mockReset();
  vi.mocked(api.delete).mockReset();
});

describe("Dashboard", () => {
  it("shows places first on small screens and switches to equipment", async () => {
    renderApp(<Dashboard />);
    await screen.findByText("Main hall");
    // each section sits in a wrapper that is `hidden` on small screens unless its tab is active
    const wrapperOf = (heading: string) => screen.getByRole("heading", { name: heading }).closest('div[class*="lg:block"]')!;

    expect(wrapperOf("Party-Orte").className).not.toMatch(/\bhidden\b/);
    expect(wrapperOf("Equipment").className).toMatch(/\bhidden\b/);

    await userEvent.click(screen.getByRole("tab", { name: /Equipment/ }));

    expect(wrapperOf("Party-Orte").className).toMatch(/\bhidden\b/);
    expect(wrapperOf("Equipment").className).not.toMatch(/\bhidden\b/);
  });

  it("points the floating button at the matching 'new' page", async () => {
    renderApp(<Dashboard />);
    await screen.findByText("Main hall");

    const floatingButton = () => document.querySelector("a.fixed")!;
    expect(floatingButton()).toHaveAttribute("href", "/places/new");
    expect(floatingButton()).toHaveTextContent("Neuer Ort");

    await userEvent.click(screen.getByRole("tab", { name: /Equipment/ }));
    expect(floatingButton()).toHaveAttribute("href", "/equipment/new");
    expect(floatingButton()).toHaveTextContent("Neues Equipment");
  });
});

describe("PlacesSection", () => {
  it("lists folders with their places and links each place", async () => {
    renderApp(<PlacesSection />);

    expect(await screen.findByText("Main hall")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hall" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Main hall" })).toHaveAttribute("href", "/places/p1");
    expect(screen.getByRole("link", { name: "„Main hall“ bearbeiten" })).toHaveAttribute("href", "/places/p1/edit");
    expect(screen.getByText("Hier sind noch keine Orte.")).toBeInTheDocument();
  });

  it("explains the empty state", async () => {
    folders = [];
    renderApp(<PlacesSection />);

    expect(await screen.findByText("Noch keine Orte")).toBeInTheDocument();
  });

  it("shows a message when loading fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(500, "INTERNAL_ERROR"));
    renderApp(<PlacesSection />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Etwas ist schiefgelaufen");
  });

  it("creates a folder", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: "f3", name: "Terrace", places: [] });
    renderApp(<PlacesSection />);
    await screen.findByText("Main hall");

    await userEvent.click(screen.getByRole("button", { name: "Neuer Ordner" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Name des Ordners"), "Terrace");
    await userEvent.click(dialog.getByRole("button", { name: "Erstellen" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/folders", { name: "Terrace" }));
  });

  it("renames a folder, starting from its current name", async () => {
    vi.mocked(api.patch).mockResolvedValue({});
    renderApp(<PlacesSection />);
    await screen.findByText("Main hall");

    await userEvent.click(screen.getAllByRole("button", { name: "Ordner umbenennen" })[0]);
    const dialog = within(await screen.findByRole("dialog"));
    const input = dialog.getByLabelText("Name des Ordners");
    expect(input).toHaveValue("Hall");
    await userEvent.clear(input);
    await userEvent.type(input, "Big hall");
    await userEvent.click(dialog.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/folders/f1", { name: "Big hall" }));
  });

  it("warns how many places go with a folder before deleting it", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);
    renderApp(<PlacesSection />);
    await screen.findByText("Main hall");

    await userEvent.click(screen.getAllByRole("button", { name: "Ordner löschen" })[0]);

    expect(await screen.findByText(/„Hall“ wird mit 2 Orten endgültig gelöscht/)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/folders/f1"));
  });

  it("deletes a place only after confirmation", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);
    renderApp(<PlacesSection />);
    await screen.findByText("Main hall");

    await userEvent.click(screen.getByRole("button", { name: "„Cellar“ löschen" }));
    expect(await screen.findByText("Möchtest du „Cellar“ wirklich löschen?")).toBeInTheDocument();
    await userEvent.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Löschen" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/places/p2"));
  });

  it("does not delete when the dialog is cancelled", async () => {
    renderApp(<PlacesSection />);
    await screen.findByText("Main hall");

    await userEvent.click(screen.getByRole("button", { name: "„Cellar“ löschen" }));
    await userEvent.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: "Abbrechen" }));

    expect(api.delete).not.toHaveBeenCalled();
  });
});

describe("EquipmentSection", () => {
  it("shows a card per item with category and edit link", async () => {
    renderApp(<EquipmentSection />);

    expect(await screen.findByText("Truss")).toBeInTheDocument();
    expect(screen.getByText("Fog machine")).toBeInTheDocument();
    expect(screen.getByText("Ständer")).toBeInTheDocument();
    expect(screen.getByText("Anderes")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "„Truss“ bearbeiten" })[0]).toHaveAttribute("href", "/equipment/e1/edit");
  });

  it("explains the empty state", async () => {
    equipment = [];
    renderApp(<EquipmentSection />);

    expect(await screen.findByText("Noch kein Equipment")).toBeInTheDocument();
  });

  it("deletes equipment after confirmation and warns that markers lose their assignment", async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);
    renderApp(<EquipmentSection />);
    await screen.findByText("Truss");

    await userEvent.click(screen.getByRole("button", { name: "„Truss“ löschen" }));
    expect(await screen.findByText(/verlieren ihre Zuordnung/)).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Löschen" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/equipment/e1"));
  });
});
