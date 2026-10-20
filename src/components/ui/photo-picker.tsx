"use client";

import { useRef, useState, useCallback } from "react";
import { uploadAcademyPhoto, removeAcademyPhoto } from "@/app/actions/photos";
import { Camera, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AutoProps {
  mode: "auto";
  /** Current list of saved photo URLs (from Organization.photos). */
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

interface ManualProps {
  mode: "manual";
  /** Current list of picked File + preview URL pairs (not yet uploaded). */
  files: Array<{ file: File; previewUrl: string }>;
  onChange: (files: Array<{ file: File; previewUrl: string }>) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

type Props = AutoProps | ManualProps;

/** Client-side resize so big phone photos don't blow bandwidth. */
async function resizeImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Not an image");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Resize failed"))),
      "image/jpeg",
      quality,
    ),
  );
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

/**
 * Up to N photo thumbnails + an "add" tile.
 *
 * - `mode="auto"` (settings): picked files upload immediately via server
 *   action; `photos` is URLs from `Organization.photos`.
 * - `mode="manual"` (onboarding, pre-Org): files are kept in memory with
 *   preview URLs; parent uploads after the Org row is created.
 */
export function PhotoPicker(props: Props) {
  const { mode, maxPhotos = 6, disabled } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const currentCount = mode === "auto" ? props.photos.length : props.files.length;
  const canAdd = currentCount < maxPhotos && !disabled;

  const triggerPicker = () => inputRef.current?.click();

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const slots = maxPhotos - currentCount;
      if (slots <= 0) {
        toast.error(`Max ${maxPhotos} photos.`);
        return;
      }
      const files = Array.from(fileList).slice(0, slots);
      setBusy(true);
      try {
        const resized: File[] = [];
        for (const f of files) {
          if (!f.type.startsWith("image/")) {
            toast.error(`${f.name} is not an image.`);
            continue;
          }
          try {
            resized.push(await resizeImage(f));
          } catch {
            toast.error(`Could not process ${f.name}.`);
          }
        }
        if (resized.length === 0) return;

        if (mode === "auto") {
          const newUrls: string[] = [];
          for (const resizedFile of resized) {
            const fd = new FormData();
            fd.append("file", resizedFile);
            const res = await uploadAcademyPhoto(fd);
            if (res.success) {
              newUrls.push(res.url);
            } else {
              toast.error(res.error);
            }
          }
          if (newUrls.length > 0) {
            props.onChange([...props.photos, ...newUrls]);
            toast.success(
              newUrls.length === 1 ? "Photo uploaded." : `${newUrls.length} photos uploaded.`,
            );
          }
        } else {
          const added = resized.map((f) => ({ file: f, previewUrl: URL.createObjectURL(f) }));
          props.onChange([...props.files, ...added]);
        }
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, currentCount, maxPhotos],
  );

  const handleRemove = async (index: number) => {
    if (mode === "auto") {
      const url = props.photos[index];
      setBusy(true);
      const res = await removeAcademyPhoto(url);
      setBusy(false);
      if (res.success) {
        props.onChange(props.photos.filter((_, i) => i !== index));
      } else {
        toast.error(res.error || "Could not remove photo.");
      }
    } else {
      const entry = props.files[index];
      URL.revokeObjectURL(entry.previewUrl);
      props.onChange(props.files.filter((_, i) => i !== index));
    }
  };

  const tiles =
    mode === "auto"
      ? props.photos.map((url, i) => ({ url, index: i, key: url }))
      : props.files.map((entry, i) => ({ url: entry.previewUrl, index: i, key: entry.previewUrl }));

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <div
            key={t.key}
            className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.url} alt={`Academy photo ${t.index + 1}`} className="w-full h-full object-cover" />
            {t.index === 0 && (
              <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wider font-bold bg-lime-400 text-zinc-950 px-1.5 py-0.5 rounded">
                Hero
              </span>
            )}
            <button
              type="button"
              onClick={() => handleRemove(t.index)}
              disabled={busy || disabled}
              aria-label="Remove photo"
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white opacity-80 sm:opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-rose-500 transition-opacity disabled:opacity-30"
            >
              <X className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={triggerPicker}
            disabled={busy}
            className={cn(
              "aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs transition-colors",
              busy
                ? "border-zinc-700 text-zinc-500 cursor-wait"
                : "border-zinc-700 text-zinc-400 hover:border-lime-400/50 hover:text-lime-300 hover:bg-lime-400/5",
            )}
          >
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
            ) : (
              <>
                <Camera className="w-5 h-5" aria-hidden />
                <span>Add photo</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="mt-2 text-[11px] text-zinc-500">
        {currentCount === 0
          ? `Add up to ${maxPhotos} photos. First one shows as the hero.`
          : `${currentCount} of ${maxPhotos} photos. First one is the hero image.`}
      </p>
    </div>
  );
}
