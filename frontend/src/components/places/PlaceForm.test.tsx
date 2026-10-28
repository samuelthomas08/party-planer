import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Equipment, Folder, Place } from "@/lib/types";
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
import { PlaceForm } from "./PlaceForm";

const folders: Folder[] = [{ id: "f1", name: "Hall", places: [] }, { id: "f2", name: "Garden", places: [] }];
const equipment: Equipment[] = [{ id: "e1", title: "Truss", description: "", category: "STAND", images: {} }];
const existing: Place = {
  id: "p1", name: "Main hall", folderId: "f1", floorPlanImageId: "plan1",
  placements: [
    { id: "server-marker-1", x: 0.2, y: 0.3, equipmentId: "e1", color: "#5672e4" },
    { id: "server-marker-2", x: 0.8, y: 0.6, equipmentId: null, color: "#f2559b" },
  ],
};

function mockApi(foldersData: Folder[] = folders) {
  vi.mocked(api.get).mockImplementation(async (path: string) => (path === "/folders" ? foldersData : path === "/equipment" ? equipment : []));
}

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.put).mockReset();
  router.push.mockClear();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}),
  });
});

describe("PlaceForm (create)", () => {
  it("asks for the required fields before anything is sent", async () => {
    mockApi();
    renderApp(<PlaceForm />);
    await screen.findByRole("option", { name: "Hall" });

    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.getAllByText("Pflichtfeld").length).toBeGreaterThan(0);
    expect(screen.getByText("Bitte lade einen Grundriss hoch.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("lets the user create the first folder inline when none exists", async () => {
    mockApi([]);
    renderApp(<PlaceForm />);

    expect(await screen.findByLabelText("Name des Ordners")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Neuer Ordner/ })).toBeInTheDocument();
  });

  it("offers a new-folder option next to existing folders", async () => {
    mockApi();
    renderApp(<PlaceForm />);

    const select = await screen.findByLabelText("Ordner");
    await userEvent.selectOptions(select, "__new__");

    expect(await screen.findByLabelText("Name des Ordners")).toBeInTheDocument();
  });
});

describe("PlaceForm (edit)", () => {
  async function setup() {
    mockApi();
    vi.mocked(api.put).mockResolvedValue({ ...existing });
    const view = renderApp(<PlaceForm initial={existing} />);
    await screen.findByRole("option", { name: "Hall" });
    return view;
  }

  it("starts with the saved values and lists the markers", async () => {
    await setup();
    expect(screen.getByLabelText("Name des Ortes")).toHaveValue("Main hall");
    expect(screen.getByRole("list", { name: "Markierungen" }).querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByAltText("Grundriss")).toHaveAttribute("src", "/api/images/plan1");
  });

  it("keeps the ids of existing markers when saving, so their history stays attached", async () => {
    await setup();
    await userEvent.clear(screen.getByLabelText("Name des Ortes"));
    await userEvent.type(screen.getByLabelText("Name des Ortes"), "Main hall XL");

    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [path, body] = vi.mocked(api.put).mock.calls[0] as [string, { name: string; folderId: string; floorPlanImageId: string; placements: Array<Record<string, unknown>> }];
    expect(path).toBe("/places/p1");
    expect(body).toMatchObject({ name: "Main hall XL", folderId: "f1", floorPlanImageId: "plan1" });
    expect(body.placements).toEqual([
      { id: "server-marker-1", x: 0.2, y: 0.3, equipmentId: "e1", color: "#5672e4" },
      { id: "server-marker-2", x: 0.8, y: 0.6, equipmentId: null, color: "#f2559b" },
    ]);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/places/p1"));
  });

  it("sends no id for markers added in this session", async () => {
    await setup();

    await userEvent.click(screen.getByRole("button", { name: "Markierung setzen" }));
    fireEvent.click(screen.getByAltText("Grundriss"), { clientX: 100, clientY: 100 });
    await userEvent.click(await screen.findByRole("button", { name: "Fertig" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const placements = (vi.mocked(api.put).mock.calls[0][1] as { placements: Array<{ id?: string; x: number; y: number }> }).placements;
    expect(placements).toHaveLength(3);
    expect(placements[2].id).toBeUndefined();
    expect(placements[2].x).toBeCloseTo(0.25);
    expect(placements[2].y).toBeCloseTo(0.5);
  });

  it("removes a marker through its panel", async () => {
    await setup();

    await userEvent.click(screen.getByRole("button", { name: "Markierung 1" }));
    await userEvent.click(await screen.findByRole("button", { name: "Entfernen" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const placements = (vi.mocked(api.put).mock.calls[0][1] as { placements: Array<{ id?: string }> }).placements;
    expect(placements.map((p) => p.id)).toEqual(["server-marker-2"]);
  });

  it("assigns equipment and colour to the selected marker", async () => {
    await setup();

    await userEvent.click(screen.getByRole("button", { name: "Markierung 2" }));
    await userEvent.click(await screen.findByRole("radio", { name: /Truss/ }));
    await userEvent.click(screen.getByRole("button", { name: "#3fae35" }));
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const placements = (vi.mocked(api.put).mock.calls[0][1] as { placements: Array<{ id?: string; equipmentId: string | null; color: string }> }).placements;
    expect(placements[1]).toMatchObject({ id: "server-marker-2", equipmentId: "e1", color: "#3fae35" });
  });

  it("shows the server's reason and stays on the form when saving fails", async () => {
    await setup();
    vi.mocked(api.put).mockRejectedValue(new ApiError(400, "EQUIPMENT_INVALID"));

    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Equipment existiert nicht mehr");
    expect(router.push).not.toHaveBeenCalled();
  });
});
