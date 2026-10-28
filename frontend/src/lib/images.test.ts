import { beforeEach, describe, expect, it, vi } from "vitest";

const compress = vi.fn();
const post = vi.fn();

vi.mock("browser-image-compression", () => ({ default: (...args: unknown[]) => compress(...args) }));
vi.mock("./api", () => ({ api: { post: (...args: unknown[]) => post(...args) } }));
vi.mock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { ACCEPTED_IMAGE_TYPES, UnsupportedImageError, uploadImage } from "./images";

beforeEach(() => {
  compress.mockReset();
  post.mockReset();
});

describe("uploadImage", () => {
  it("accepts exactly the types the backend accepts", () => {
    expect(ACCEPTED_IMAGE_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });

  it("rejects other file types before doing any work", async () => {
    const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });

    await expect(uploadImage(svg, { maxSizeMB: 1, maxDimension: 800 })).rejects.toBeInstanceOf(UnsupportedImageError);
    expect(compress).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("compresses with the requested limits, uploads as multipart and returns the new id", async () => {
    const original = new File(["x".repeat(100)], "photo.png", { type: "image/png" });
    const shrunk = new Blob(["x"], { type: "image/png" });
    compress.mockResolvedValue(shrunk);
    post.mockResolvedValue({ id: "new-image-id" });

    const id = await uploadImage(original, { maxSizeMB: 0.15, maxDimension: 800 });

    expect(id).toBe("new-image-id");
    expect(compress).toHaveBeenCalledWith(original, { maxSizeMB: 0.15, maxWidthOrHeight: 800, useWebWorker: true });
    const [path, body] = post.mock.calls[0];
    expect(path).toBe("/images");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(Blob);
  });

  it("passes upload errors on to the caller", async () => {
    compress.mockResolvedValue(new Blob(["x"]));
    post.mockRejectedValue(new Error("413"));

    await expect(uploadImage(new File(["x"], "a.png", { type: "image/png" }), { maxSizeMB: 1, maxDimension: 800 })).rejects.toThrow("413");
  });
});
