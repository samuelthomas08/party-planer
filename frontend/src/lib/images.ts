import imageCompression from "browser-image-compression";
import { api } from "./api";
import { log } from "./logger";

/** Types the server accepts. */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Thrown when a picked file is not PNG / JPEG / WebP. */
export class UnsupportedImageError extends Error {}

/** Shrinks the picked file in the browser, then uploads it. Returns the new image id. */
export async function uploadImage(file: File, opts: { maxSizeMB: number; maxDimension: number }): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    log.warn("IMAGE_UPLOAD_REJECTED", `unsupported type ${file.type || "unknown"}`);
    throw new UnsupportedImageError();
  }

  log.info("IMAGE_UPLOAD_START", file.type, { bytes: file.size });
  const compressed = await imageCompression(file, {
    maxSizeMB: opts.maxSizeMB,
    maxWidthOrHeight: opts.maxDimension,
    useWebWorker: true,
  });
  const form = new FormData();
  form.append("file", compressed, file.name);
  const { id } = await api.post<{ id: string }>("/images", form);
  log.info("IMAGE_UPLOAD_DONE", id, { before: file.size, after: compressed.size });
  return id;
}
