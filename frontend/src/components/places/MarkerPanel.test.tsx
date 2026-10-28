import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setImageBase } from "@/lib/api";
import type { Equipment, Placement } from "@/lib/types";
import { renderApp } from "@/test/utils";
import { MarkerEditPanel, MarkerViewPanel } from "./MarkerPanel";

const placement: Placement = { id: "m1", x: 0.5, y: 0.5, equipmentId: null, color: "#5672e4" };

const equipment = (n: number): Equipment[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i}`, title: `Item ${i}`, description: i === 0 ? "A very bright light" : "", category: i % 2 ? "OTHER" : "STAND",
    images: i % 2 ? { PHOTO: `img${i}` } : { FOOT: `img${i}` },
  }));

beforeEach(() => setImageBase("/api/images"));

function setupEdit(items: Equipment[], extra: Partial<Placement> = {}) {
  const handlers = { onChange: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };
  renderApp(<MarkerEditPanel index={2} placement={{ ...placement, ...extra }} equipment={items} {...handlers} />);
  return handlers;
}

describe("MarkerEditPanel", () => {
  it("is titled with the marker number", () => {
    setupEdit(equipment(2));
    expect(screen.getByRole("heading", { name: "Markierung 3" })).toBeInTheDocument();
  });

  it("lists the equipment as a radio group and assigns the chosen one", async () => {
    const { onChange } = setupEdit(equipment(3));
    await userEvent.click(screen.getByRole("radio", { name: /Item 1/ }));
    expect(onChange).toHaveBeenCalledWith({ equipmentId: "e1" });
  });

  it("marks the assigned equipment and un-assigns it when chosen again", async () => {
    const { onChange } = setupEdit(equipment(3), { equipmentId: "e2" });
    const chosen = screen.getByRole("radio", { name: /Item 2/ });
    expect(chosen).toHaveAttribute("aria-checked", "true");
    await userEvent.click(chosen);
    expect(onChange).toHaveBeenCalledWith({ equipmentId: null });
  });

  it("tells the user to create equipment first when there is none", () => {
    setupEdit([]);
    expect(screen.getByText(/noch kein Equipment angelegt/)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("offers search only for longer lists and filters case-insensitively", async () => {
    setupEdit(equipment(4));
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("filters a long list and says when nothing matches", async () => {
    setupEdit(equipment(8));
    const search = screen.getByRole("searchbox");

    await userEvent.type(search, "item 5");
    expect(screen.getAllByRole("radio")).toHaveLength(1);

    await userEvent.clear(search);
    await userEvent.type(search, "zzz");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText("Keine Treffer.")).toBeInTheDocument();
  });

  it("changes the colour via the presets", async () => {
    const { onChange } = setupEdit(equipment(1));
    await userEvent.click(screen.getByRole("button", { name: "#f2559b" }));
    expect(onChange).toHaveBeenCalledWith({ color: "#f2559b" });
  });

  it("marks the current colour", () => {
    setupEdit(equipment(1), { color: "#e5304b" });
    expect(screen.getByRole("button", { name: "#e5304b" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "#5672e4" })).toHaveAttribute("aria-pressed", "false");
  });

  it("removes the marker and can be closed", async () => {
    const { onDelete, onClose } = setupEdit(equipment(1));
    await userEvent.click(screen.getByRole("button", { name: "Entfernen" }));
    expect(onDelete).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("MarkerViewPanel", () => {
  it("shows title, category and description of the assigned equipment", () => {
    renderApp(<MarkerViewPanel index={0} placement={placement} equipment={equipment(1)[0]} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Item 0" })).toBeInTheDocument();
    expect(screen.getByText("Ständer")).toBeInTheDocument();
    expect(screen.getByText("A very bright light")).toBeInTheDocument();
  });

  it("says so when the equipment has no description", () => {
    renderApp(<MarkerViewPanel index={0} placement={placement} equipment={equipment(2)[1]} onClose={() => {}} />);
    expect(screen.getByText("Keine Beschreibung vorhanden.")).toBeInTheDocument();
  });

  it("explains an unassigned marker", () => {
    renderApp(<MarkerViewPanel index={0} placement={placement} equipment={undefined} onClose={() => {}} />);
    expect(screen.getByText("Kein Equipment zugewiesen")).toBeInTheDocument();
  });

  it("can be closed", async () => {
    const onClose = vi.fn();
    renderApp(<MarkerViewPanel index={0} placement={placement} equipment={undefined} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(onClose).toHaveBeenCalled();
  });
});
