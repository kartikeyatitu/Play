"use client";

import { useCallback, useState, useTransition } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteMediaAsset, listContextMedia, setMediaTags, type StaffMediaItem } from "@/app/actions/media-assets";
import type { MediaContextType } from "@/lib/media/constants";
import { AddPhotos } from "./AddPhotos";
import { TagPicker, type TaggableStudent } from "./TagPicker";

/** Staff view of one context: add photos, grid, tag and delete. Academy staff always see these. */
export function MediaManager({
  contextType,
  contextId,
  initialItems,
  students,
  canUpload,
  canDeleteAny,
}: {
  contextType: MediaContextType;
  contextId: string | null;
  initialItems: StaffMediaItem[];
  students: TaggableStudent[];
  canUpload: boolean;
  /** Owners and managers; coaches can only change their own uploads. */
  canDeleteAny: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState<StaffMediaItem | null>(null);

  const refresh = useCallback(async () => {
    const r = await listContextMedia({ contextType, contextId });
    if (r.ok) setItems(r.items);
  }, [contextType, contextId]);

  return (
    <div className="space-y-5">
      {canUpload && <AddPhotos contextType={contextType} contextId={contextId} students={students} onUploaded={refresh} />}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">No photos here yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setOpen(m)} className="relative block aspect-square w-full overflow-hidden rounded-lg bg-surface-2"
                aria-label={m.tagged.length ? `Photo with ${m.tagged.map((t) => t.name).join(", ")}` : "Untagged photo"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${m.id}?v=thumb`} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded-full bg-canvas/85 px-1.5 text-[10px] font-medium text-ink">
                  {m.tagged.length ? `${m.tagged.length} tagged` : "Untagged"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <PhotoSheet
          item={open}
          students={students}
          canEdit={canUpload && (canDeleteAny || open.mine)}
          onClose={() => setOpen(null)}
          onChanged={async () => {
            await refresh();
          }}
          onDeleted={(id) => {
            setItems((prev) => prev.filter((p) => p.id !== id));
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function PhotoSheet({
  item,
  students,
  canEdit,
  onClose,
  onChanged,
  onDeleted,
}: {
  item: StaffMediaItem;
  students: TaggableStudent[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const [tags, setTags] = useState(item.tagged.map((t) => t.id));
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  // Students outside the taggable list (e.g. tagged by an admin) still show as selected chips.
  const options = [...students, ...item.tagged.filter((t) => !students.some((s) => s.id === t.id))];

  const save = () =>
    start(async () => {
      const r = await setMediaTags(item.id, tags);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Tags saved");
      await onChanged();
    });

  const remove = () =>
    start(async () => {
      const r = await deleteMediaAsset(item.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Photo deleted");
      onDeleted(item.id);
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal aria-label="Photo">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-canvas p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-ink-muted">{new Date(item.createdAt).toLocaleString()}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/media/${item.id}`} alt="" className="w-full rounded-xl bg-surface-2 object-contain" />

        {canEdit ? (
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-medium text-ink">Tagged players</h3>
            <TagPicker students={options} selected={tags} onChange={setTags} disabled={pending} />
            <button type="button" onClick={save} disabled={pending}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-volt font-semibold text-volt-fg disabled:opacity-50">
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save tags
            </button>
            {confirming ? (
              <div className="flex gap-2">
                <button type="button" onClick={remove} disabled={pending} className="min-h-[48px] flex-1 rounded-xl bg-danger font-semibold text-white disabled:opacity-50">
                  Delete for everyone
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-[48px] flex-1 rounded-xl border border-line text-ink">
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-line text-danger">
                <Trash2 className="h-4 w-4" aria-hidden /> Delete photo
              </button>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            {item.tagged.length ? `Tagged: ${item.tagged.map((t) => t.name).join(", ")}` : "No players tagged."}
          </p>
        )}
      </div>
    </div>
  );
}
