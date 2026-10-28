import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setImageBase } from "@/lib/api";
import type { Placement } from "@/lib/types";
import { FloorPlan } from "./FloorPlan";

const placements: Placement[] = [
  { id: "m1", x: 0.25, y: 0.5, equipmentId: null, color: "#5672e4" },
  { id: "m2", x: 0.75, y: 0.1, equipmentId: null, color: "#f59e0b" },
];

function setup(props: Partial<React.ComponentProps<typeof FloorPlan>> = {}) {
  const handlers = { onSelect: vi.fn(), onAdd: vi.fn(), onMove: vi.fn() };
  const view = render(
    <FloorPlan
      imageId="plan"
      placements={placements}
      selectedId={null}
      markerLabel={(i) => (i < 0 ? "Tap to place" : `Marker ${i + 1}`)}
      planLabel="Floor plan"
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, ...view };
}

beforeEach(() => {
  setImageBase("/api/images");
  // The plan occupies 400×200 px at (100, 50) on screen.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250, x: 100, y: 50, toJSON: () => ({}),
  });
});

describe("FloorPlan rendering", () => {
  it("shows the plan image", () => {
    setup();
    expect(screen.getByAltText("Floor plan")).toHaveAttribute("src", "/api/images/plan");
  });

  it("draws a numbered marker at its relative position, in its colour", () => {
    setup();
    const first = screen.getByRole("button", { name: "Marker 1" });
    expect(first).toHaveStyle({ left: "25%", top: "50%" });
    expect(first).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Marker 2" })).toHaveTextContent("2");
    expect(first.querySelector("span")!.style.backgroundColor).toBe("rgb(86, 114, 228)");
  });

  it("marks the selected marker", () => {
    setup({ selectedId: "m2" });
    expect(screen.getByRole("button", { name: "Marker 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Marker 1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("uses readable text colours on light markers", () => {
    setup();
    expect(screen.getByRole("button", { name: "Marker 2" }).querySelector("span")).toHaveStyle({ color: "#1a1f3a" });
    expect(screen.getByRole("button", { name: "Marker 1" }).querySelector("span")).toHaveStyle({ color: "#ffffff" });
  });
});

describe("FloorPlan in view mode", () => {
  it("selects a marker on click", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Marker 2" }));
    expect(onSelect).toHaveBeenCalledWith("m2");
  });

  it("deselects when the plan itself is clicked", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByAltText("Floor plan"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("cannot be dragged or nudged", () => {
    const { onMove } = setup();
    const marker = screen.getByRole("button", { name: "Marker 1" });
    fireEvent.pointerDown(marker, { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(marker, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.keyDown(marker, { key: "ArrowRight" });
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe("FloorPlan in edit mode", () => {
  it("adds a marker at the tapped relative position when 'add' mode is on", () => {
    const { onAdd } = setup({ editable: true, addMode: true });
    fireEvent.click(screen.getByAltText("Floor plan"), { clientX: 300, clientY: 150 });
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [x, y] = onAdd.mock.calls[0];
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.5);
  });

  it("clamps taps next to the edge into the image", () => {
    const { onAdd } = setup({ editable: true, addMode: true });
    fireEvent.click(screen.getByAltText("Floor plan"), { clientX: 900, clientY: 0 });
    expect(onAdd).toHaveBeenCalledWith(1, 0);
  });

  it("explains what to do while 'add' mode is on", () => {
    setup({ editable: true, addMode: true });
    expect(screen.getByText("Tap to place")).toBeInTheDocument();
  });

  it("does not add markers when 'add' mode is off", () => {
    const { onAdd, onSelect } = setup({ editable: true });
    fireEvent.click(screen.getByAltText("Floor plan"), { clientX: 300, clientY: 150 });
    expect(onAdd).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("drags a marker to a new relative position without selecting it", () => {
    const { onMove, onSelect } = setup({ editable: true });
    const marker = screen.getByRole("button", { name: "Marker 1" });

    fireEvent.pointerDown(marker, { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(marker, { clientX: 400, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(marker, { pointerId: 1 });

    const [id, x, y] = onMove.mock.calls.at(-1)!;
    expect(id).toBe("m1");
    expect(x).toBeCloseTo(0.75);
    expect(y).toBeCloseTo(0.25);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("treats a tiny wobble as a tap and selects the marker instead of moving it", () => {
    const { onMove, onSelect } = setup({ editable: true });
    const marker = screen.getByRole("button", { name: "Marker 1" });

    fireEvent.pointerDown(marker, { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(marker, { clientX: 202, clientY: 151, pointerId: 1 });
    fireEvent.pointerUp(marker, { pointerId: 1 });

    expect(onMove).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("m1");
  });

  it("keeps a dragged marker inside the image", () => {
    const { onMove } = setup({ editable: true });
    const marker = screen.getByRole("button", { name: "Marker 1" });

    fireEvent.pointerDown(marker, { clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(marker, { clientX: 5000, clientY: -5000, pointerId: 1 });

    expect(onMove).toHaveBeenLastCalledWith("m1", 1, 0);
  });

  it("nudges with the arrow keys: 1% normally, 5% with shift, never outside the image", () => {
    const { onMove } = setup({ editable: true });
    const marker = screen.getByRole("button", { name: "Marker 1" });

    fireEvent.keyDown(marker, { key: "ArrowRight" });
    fireEvent.keyDown(marker, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(marker, { key: "ArrowLeft" });
    fireEvent.keyDown(marker, { key: "ArrowUp" });

    expect(onMove.mock.calls[0][1]).toBeCloseTo(0.26);
    expect(onMove.mock.calls[1][2]).toBeCloseTo(0.55);
    expect(onMove.mock.calls[2][1]).toBeCloseTo(0.24);
    expect(onMove.mock.calls[3][2]).toBeCloseTo(0.49);

  });

  it("never nudges a marker beyond the edges", () => {
    const { onMove } = setup({ editable: true, placements: [{ id: "edge", x: 0.99, y: 0.03, equipmentId: null, color: "#000000" }] });
    const marker = screen.getByRole("button", { name: "Marker 1" });

    fireEvent.keyDown(marker, { key: "ArrowUp", shiftKey: true });
    fireEvent.keyDown(marker, { key: "ArrowRight", shiftKey: true });

    expect(onMove).toHaveBeenNthCalledWith(1, "edge", 0.99, 0);
    expect(onMove).toHaveBeenNthCalledWith(2, "edge", 1, 0.03);
  });

  it("ignores other keys", () => {
    const { onMove } = setup({ editable: true });
    fireEvent.keyDown(screen.getByRole("button", { name: "Marker 1" }), { key: "Enter" });
    expect(onMove).not.toHaveBeenCalled();
  });
});
