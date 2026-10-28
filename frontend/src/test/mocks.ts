import { vi } from "vitest";

/** Shared router double. Tests assert on `push` / `replace`. */
export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() };

export const params: Record<string, string> = {};
export let pathname = "/";
export const setPathname = (value: string) => {
  pathname = value;
};
