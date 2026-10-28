import type { EquipmentSlot } from "./types";

/**
 * Geometry of the lighting-stand illustration, from the original design (510 × 573 px box),
 * converted to percentages so it scales to any container.
 */
const W = 510;
const H = 573;

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

/** Position of one image slot in percent of the stand drawing. */
export interface SlotBox {
  slot: EquipmentSlot;
  left: string;
  top: string;
  width: string;
  height: string;
  z: number;
}

const box = (slot: EquipmentSlot, x: number, y: number, w: number, h: number, z = 1): SlotBox => ({
  slot,
  left: pct(x, W),
  top: pct(y, H),
  width: pct(w, W),
  height: pct(h, H),
  z,
});

/** CSS aspect ratio of the stand drawing. */
export const STAND_ASPECT = `${W} / ${H}`;

/** All slots of the stand drawing, back to front. */
export const STAND_SLOTS: SlotBox[] = [
  box("FOOT", 165, 138, 180, 435, 1),
  box("TOP_BAR", 0, 65, 510, 73, 3),
  box("TOP_BAR_ADD_1", 50, 0, 205, 65, 2),
  box("TOP_BAR_ADD_2", 255, 0, 205, 65, 2),
  box("LIGHT_1", 10, 138, 90, 110, 2),
  box("LIGHT_2", 100, 138, 90, 110, 2),
  box("LIGHT_3", 210, 138, 90, 110, 2),
  box("LIGHT_4", 320, 138, 90, 110, 2),
  box("LIGHT_5", 410, 138, 90, 110, 2),
];
