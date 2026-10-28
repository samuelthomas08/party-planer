import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Equipment } from "@/lib/types";
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

import { api } from "@/lib/api";
import { EquipmentForm } from "./EquipmentForm";

const stand: Equipment = {
  id: "e1", title: "Truss", description: "Heavy", category: "STAND", images: { FOOT: "foot1", TOP_BAR: "bar1" },
};

beforeEach(() => {
  vi.mocked(api.post).mockReset();
  vi.mocked(api.put).mockReset();
  router.push.mockClear();
});

describe("EquipmentForm (create)", () => {
  it("requires a name", async () => {
    renderApp(<EquipmentForm />);

    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.getByText("Pflichtfeld")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("creates a stand without images (they are optional)", async () => {
    vi.mocked(api.post).mockResolvedValue({ ...stand });
    renderApp(<EquipmentForm />);

    await userEvent.type(screen.getByLabelText("Name"), "  Spot ");
    await userEvent.type(screen.getByLabelText("Beschreibung"), "Bright");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/equipment", { title: "Spot", description: "Bright", category: "STAND", images: {} }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
  });

  it("insists on a photo for other equipment", async () => {
    renderApp(<EquipmentForm />);

    await userEvent.click(screen.getByRole("tab", { name: "Anderes" }));
    await userEvent.type(screen.getByLabelText("Name"), "Fog machine");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.getByText("Bitte füge ein Bild hinzu.", { selector: "p" })).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("switches between the stand drawing and the single photo", async () => {
    renderApp(<EquipmentForm />);
    expect(screen.getAllByRole("button", { name: /Licht|Fuß|Querträger|Aufsatz/ })).toHaveLength(9);

    await userEvent.click(screen.getByRole("tab", { name: "Anderes" }));

    expect(screen.queryByRole("button", { name: "Licht 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Foto" })).toBeInTheDocument();
  });

  it("opens the image dialog when a slot is tapped", async () => {
    renderApp(<EquipmentForm />);

    await userEvent.click(screen.getByRole("button", { name: "Fuß" }));

    expect(await screen.findByRole("heading", { name: "Fuß" })).toBeInTheDocument();
    expect(screen.getByText("Bild auswählen oder aufnehmen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bild entfernen" })).not.toBeInTheDocument();
  });
});

describe("EquipmentForm (edit)", () => {
  it("starts with the saved values", () => {
    renderApp(<EquipmentForm initial={stand} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Truss");
    expect(screen.getByLabelText("Beschreibung")).toHaveValue("Heavy");
    expect(screen.getByRole("button", { name: "Fuß" }).querySelector("img")).toHaveAttribute("src", "/api/images/foot1");
  });

  it("updates through PUT and keeps the existing images", async () => {
    vi.mocked(api.put).mockResolvedValue(stand);
    renderApp(<EquipmentForm initial={stand} />);

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Truss XL");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/equipment/e1", {
      title: "Truss XL", description: "Heavy", category: "STAND", images: { FOOT: "foot1", TOP_BAR: "bar1" },
    }));
  });

  it("removes an image through the slot dialog", async () => {
    vi.mocked(api.put).mockResolvedValue(stand);
    renderApp(<EquipmentForm initial={stand} />);

    await userEvent.click(screen.getByRole("button", { name: "Fuß" }));
    await userEvent.click(await screen.findByRole("button", { name: "Bild entfernen" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect((vi.mocked(api.put).mock.calls[0][1] as { images: object }).images).toEqual({ TOP_BAR: "bar1" });
  });

  it("drops stand parts when the type is switched to other equipment, so the server never sees invalid slots", async () => {
    renderApp(<EquipmentForm initial={{ ...stand, images: { FOOT: "foot1" } }} />);

    await userEvent.click(screen.getByRole("tab", { name: "Anderes" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(api.put).not.toHaveBeenCalled(); // the photo is missing, and nothing invalid was sent
    expect(screen.getByText("Bitte füge ein Bild hinzu.", { selector: "p" })).toBeInTheDocument();
  });
});
