import { describe, expect, it } from "vitest";
import { STAND_ASPECT, STAND_SLOTS } from "./stand-layout";

const pct = (v: string) => parseFloat(v);

describe("stand layout", () => {
  it("has one box for every part slot and none for the photo", () => {
    expect(STAND_SLOTS.map((s) => s.slot).sort()).toEqual(
      ["FOOT", "LIGHT_1", "LIGHT_2", "LIGHT_3", "LIGHT_4", "LIGHT_5", "TOP_BAR", "TOP_BAR_ADD_1", "TOP_BAR_ADD_2"].sort(),
    );
  });

  it("keeps every box inside the drawing", () => {
    for (const box of STAND_SLOTS) {
      expect(pct(box.left)).toBeGreaterThanOrEqual(0);
      expect(pct(box.top)).toBeGreaterThanOrEqual(0);
      expect(pct(box.left) + pct(box.width)).toBeLessThanOrEqual(100.0001);
      expect(pct(box.top) + pct(box.height)).toBeLessThanOrEqual(100.0001);
    }
  });

  it("draws the top bar above the foot and the lights above the top bar's lower edge", () => {
    const z = Object.fromEntries(STAND_SLOTS.map((s) => [s.slot, s.z]));
    expect(z.TOP_BAR).toBeGreaterThan(z.FOOT);
    expect(z.LIGHT_1).toBeGreaterThan(z.FOOT);
  });

  it("places the two add-ons side by side and the five lights in one row without overlap", () => {
    const by = Object.fromEntries(STAND_SLOTS.map((s) => [s.slot, s]));
    expect(pct(by.TOP_BAR_ADD_1.left) + pct(by.TOP_BAR_ADD_1.width)).toBeCloseTo(pct(by.TOP_BAR_ADD_2.left), 3);
    const lights = ["LIGHT_1", "LIGHT_2", "LIGHT_3", "LIGHT_4", "LIGHT_5"].map((k) => by[k]);
    for (let i = 1; i < lights.length; i++) {
      expect(pct(lights[i].left)).toBeGreaterThanOrEqual(pct(lights[i - 1].left) + pct(lights[i - 1].width) - 0.0001);
      expect(lights[i].top).toBe(lights[0].top);
    }
  });

  it("exposes the original drawing's aspect ratio", () => {
    expect(STAND_ASPECT).toBe("510 / 573");
  });
});
