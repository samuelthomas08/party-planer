/** Preset marker colours. */
export const MARKER_COLORS = ["#5672e4", "#f2559b", "#e5304b", "#f59e0b", "#3fae35", "#14b8a6", "#8b5cf6", "#1a1f3a"];

const INK = "#1a1f3a";

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour (white or the app's ink) with the higher WCAG contrast on the given #rrggbb background. */
export function readableOn(hex: string): "#ffffff" | "#1a1f3a" {
  const l = luminance(hex);
  const contrastWithWhite = 1.05 / (l + 0.05);
  const contrastWithInk = (l + 0.05) / (luminance(INK) + 0.05);
  return contrastWithInk > contrastWithWhite ? INK : "#ffffff";
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
