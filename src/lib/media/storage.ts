/**
 * Media storage: the project's existing Vercel Blob store (BLOB_READ_WRITE_TOKEN, as in
 * src/app/actions/photos.ts), but with access "private". Children's photos never get a public URL:
 * the browser uploads straight to Blob with a short-lived client token (/api/media/upload), and
 * reads go through /api/media/[id], which checks canView and then streams the file.
 *
 * Server only.
 */
import { del, get, head } from "@vercel/blob";

export interface MediaStorage {
  configured(): boolean;
  exists(key: string): Promise<{ size: number; contentType: string } | null>;
  stream(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string; size: number } | null>;
  remove(keys: string[]): Promise<void>;
}

export const blobMediaStorage: MediaStorage = {
  configured: () => Boolean(process.env.BLOB_READ_WRITE_TOKEN),

  async exists(key) {
    try {
      const h = await head(key);
      return { size: h.size, contentType: h.contentType };
    } catch {
      return null;
    }
  },

  async stream(key) {
    const r = await get(key, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { body: r.stream, contentType: r.blob.contentType, size: r.blob.size };
  },

  async remove(keys) {
    if (keys.length) await del(keys);
  },
};
