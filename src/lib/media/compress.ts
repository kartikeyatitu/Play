/**
 * Browser-side photo compression. Re-encoding through a canvas drops every metadata block (EXIF,
 * GPS, camera serials), because only pixels are copied. Orientation is applied first
 * (imageOrientation: "from-image") so photos stay upright once the EXIF tag is gone.
 *
 * `fitWithin` and `pickOutputType` are pure and tested; `compressPhoto` needs a browser.
 */
import { MEDIA_QUALITY, MEDIA_THUMB_EDGE, MEDIA_WEB_EDGE } from "./constants";

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new Error("Invalid image size");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Prefer WebP; fall back to JPEG when the browser's encoder silently returns PNG (old Safari). */
export function pickOutputType(encodedType: string | undefined): "image/webp" | "image/jpeg" | null {
  if (encodedType === "image/webp") return "image/webp";
  if (encodedType === "image/jpeg") return "image/jpeg";
  return null;
}

export interface CompressedPhoto {
  web: Blob;
  thumb: Blob;
  mimeType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo format can't be read on this device. Try a JPG.");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
  types: readonly ("image/webp" | "image/jpeg")[] = ["image/webp", "image/jpeg"],
): Promise<{ blob: Blob; type: "image/webp" | "image/jpeg"; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process photos.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  for (const type of types) {
    const blob = await toBlob(canvas, type, quality);
    const picked = pickOutputType(blob?.type);
    if (blob && picked) return { blob, type: picked, width, height };
  }
  throw new Error("Could not compress this photo.");
}

export async function compressPhoto(file: Blob, opts?: { maxEdge?: number; thumbEdge?: number; quality?: number }): Promise<CompressedPhoto> {
  const bitmap = await decode(file);
  try {
    const web = await encode(bitmap, opts?.maxEdge ?? MEDIA_WEB_EDGE, opts?.quality ?? MEDIA_QUALITY);
    // Same format as the main file so both variants share the asset's content type.
    const thumb = await encode(bitmap, opts?.thumbEdge ?? MEDIA_THUMB_EDGE, 0.7, [web.type]);
    return { web: web.blob, thumb: thumb.blob, mimeType: web.type, width: web.width, height: web.height };
  } finally {
    bitmap.close();
  }
}
