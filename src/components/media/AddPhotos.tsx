"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { beginMediaUploads, completeMediaUploads, setMediaTags } from "@/app/actions/media-assets";
import { compressPhoto, type CompressedPhoto } from "@/lib/media/compress";
import { MEDIA_MAX_FILES_PER_BATCH, type MediaContextType } from "@/lib/media/constants";
import { checkInputFile } from "@/lib/media/validation";
import { cn } from "@/lib/utils";
import { TagPicker, type TaggableStudent } from "./TagPicker";

type Item = {
  key: string;
  name: string;
  preview?: string;
  photo?: CompressedPhoto;
  state: "compressing" | "ready" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

/**
 * "Add photos" for one context (session, match, tournament or the academy gallery). Phone-first:
 * camera or gallery, multi-select, photos are compressed in the browser (max 2048px, metadata and GPS
 * stripped by re-encoding), uploaded straight to private storage with progress, then tagged.
 */
export function AddPhotos({
  contextType,
  contextId,
  students,
  onUploaded,
}: {
  contextType: MediaContextType;
  contextId?: string | null;
  students: TaggableStudent[];
  onUploaded?: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (key: string, p: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const room = MEDIA_MAX_FILES_PER_BATCH - items.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (list.length > files.length) toast.info(`Up to ${MEDIA_MAX_FILES_PER_BATCH} photos at a time.`);
    const fresh: Item[] = files.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, state: "compressing", progress: 0 }));
    setItems((prev) => [...prev, ...fresh]);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = fresh[i].key;
      const check = checkInputFile(file);
      if (!check.ok) {
        patch(key, { state: "error", error: check.error });
        continue;
      }
      try {
        const photo = await compressPhoto(file);
        patch(key, { state: "ready", photo, preview: URL.createObjectURL(photo.thumb) });
      } catch (e) {
        patch(key, { state: "error", error: e instanceof Error ? e.message : "Could not read this photo." });
      }
    }
  }

  function remove(key: string) {
    setItems((prev) => {
      const it = prev.find((i) => i.key === key);
      if (it?.preview) URL.revokeObjectURL(it.preview);
      return prev.filter((i) => i.key !== key);
    });
  }

  async function uploadAll() {
    const ready = items.filter((i) => i.state === "ready" && i.photo);
    if (!ready.length) return;
    setBusy(true);
    try {
      const begun = await beginMediaUploads({
        contextType,
        contextId: contextId ?? null,
        files: ready.map((i) => ({ mimeType: i.photo!.mimeType, bytes: i.photo!.web.size, thumbBytes: i.photo!.thumb.size })),
      });
      if (!begun.ok) {
        toast.error(begun.error);
        return;
      }
      const uploaded: string[] = [];
      for (let n = 0; n < ready.length; n++) {
        const it = ready[n];
        const slot = begun.uploads[n];
        patch(it.key, { state: "uploading", progress: 0 });
        try {
          const opts = { access: "private" as const, handleUploadUrl: "/api/media/upload", clientPayload: JSON.stringify({ assetId: slot.assetId }), contentType: it.photo!.mimeType };
          await upload(slot.thumbKey, it.photo!.thumb, opts);
          await upload(slot.webKey, it.photo!.web, { ...opts, onUploadProgress: (p) => patch(it.key, { progress: Math.round(p.percentage) }) });
          uploaded.push(slot.assetId);
          patch(it.key, { progress: 100 });
        } catch {
          patch(it.key, { state: "error", error: "Upload failed. Check your connection and try again." });
        }
      }
      if (!uploaded.length) return;
      const done = await completeMediaUploads(uploaded);
      if (!done.ok) {
        toast.error(done.error);
        return;
      }
      if (tags.length) {
        for (const id of done.ready) {
          const t = await setMediaTags(id, tags);
          if (!t.ok) toast.error(t.error);
        }
      }
      setItems((prev) =>
        prev.map((i) => {
          const n = ready.findIndex((r) => r.key === i.key);
          if (n < 0) return i;
          const ok = done.ready.includes(begun.uploads[n].assetId);
          return ok ? { ...i, state: "done" as const } : { ...i, state: "error" as const, error: i.error ?? "Upload could not be confirmed." };
        }),
      );
      toast.success(`${done.ready.length} photo${done.ready.length === 1 ? "" : "s"} added`);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.state !== "done")), 1200);
      onUploaded?.();
    } finally {
      setBusy(false);
    }
  }

  const readyCount = items.filter((i) => i.state === "ready").length;
  const compressing = items.some((i) => i.state === "compressing");

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Add photos</h2>
        <span className="text-xs text-ink-muted">Private to the academy until parents allow more</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-volt font-medium text-volt-fg disabled:opacity-50">
          <Camera className="h-5 w-5" aria-hidden /> Camera
        </button>
        <button type="button" onClick={() => galleryRef.current?.click()} disabled={busy}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 font-medium text-ink disabled:opacity-50">
          <ImagePlus className="h-5 w-5" aria-hidden /> Gallery
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="hidden"
          onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((i) => (
            <li key={i.key} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
              {i.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  {i.state === "compressing" ? <Loader2 className="h-5 w-5 animate-spin text-ink-subtle" aria-label="Preparing" /> : null}
                </div>
              )}
              {(i.state === "uploading" || i.state === "done") && (
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30" role="progressbar" aria-valuenow={i.progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-volt transition-all" style={{ width: `${i.progress}%` }} />
                </div>
              )}
              {i.state === "error" && (
                <p className="absolute inset-0 flex items-center bg-canvas/85 p-2 text-center text-[11px] leading-tight text-danger">{i.error}</p>
              )}
              {!busy && i.state !== "uploading" && (
                <button type="button" onClick={() => remove(i.key)} aria-label={`Remove ${i.name}`}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-canvas/80 text-ink">
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && students.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-ink">Tag players in these photos</h3>
          <TagPicker students={students} selected={tags} onChange={setTags} disabled={busy} />
        </div>
      )}

      {items.length > 0 && (
        <button type="button" onClick={uploadAll} disabled={busy || compressing || readyCount === 0}
          className={cn("flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-volt font-semibold text-volt-fg", (busy || compressing || !readyCount) && "opacity-50")}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {busy ? "Uploading…" : compressing ? "Preparing photos…" : `Upload ${readyCount} photo${readyCount === 1 ? "" : "s"}`}
        </button>
      )}
    </section>
  );
}
