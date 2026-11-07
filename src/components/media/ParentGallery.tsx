"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { GalleryItem } from "@/app/actions/media-assets";

/** Photos this guardian may see (already filtered by canView on the server). */
export function ParentGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<GalleryItem | null>(null);
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
        No photos to show yet. Photos appear here when your child is tagged, or when every child in a photo has a
        parent who allowed sharing with the batch.
      </p>
    );
  }
  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {items.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => setOpen(m)} className="block aspect-square w-full overflow-hidden rounded-lg bg-surface-2"
              aria-label={`${m.contextLabel} photo${m.myChildren.length ? ` with ${m.myChildren.join(", ")}` : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${m.id}?v=thumb`} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal aria-label="Photo">
          <div className="flex items-center justify-between p-3 text-white">
            <p className="text-sm">
              {open.contextLabel} · {new Date(open.createdAt).toLocaleDateString()}
              {open.myChildren.length ? ` · ${open.myChildren.join(", ")}` : ""}
            </p>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${open.id}`} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
