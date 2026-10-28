import { describe, expect, it } from "vitest";
import { MARKER_COLORS, readableOn, uid } from "./color";

describe("readableOn", () => {
  it("picks dark text on light backgrounds and white text on dark ones", () => {
    expect(readableOn("#ffffff")).toBe("#1a1f3a");
    expect(readableOn("#f59e0b")).toBe("#1a1f3a");
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(readableOn("#1a1f3a")).toBe("#ffffff");
    expect(readableOn("#5672e4")).toBe("#ffffff");
  });

  it("only ever returns one of the two text colours for every preset", () => {
    for (const color of MARKER_COLORS) {
      expect(["#ffffff", "#1a1f3a"]).toContain(readableOn(color));
    }
  });
});

describe("MARKER_COLORS", () => {
  it("are distinct, valid #rrggbb values (the backend rejects anything else)", () => {
    expect(new Set(MARKER_COLORS).size).toBe(MARKER_COLORS.length);
    for (const color of MARKER_COLORS) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("uid", () => {
  it("returns different ids that need no secure context", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+$/);
  });
});
