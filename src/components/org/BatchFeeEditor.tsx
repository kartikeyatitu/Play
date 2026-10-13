"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBatchSettings } from "@/app/actions/batch";
import { Pencil, Loader2 } from "lucide-react";

/** Inline editor for a batch's monthly fee and capacity (admin only). */
export function BatchFeeEditor({
  batchId,
  monthlyFee,
  capacity,
}: {
  batchId: string;
  monthlyFee?: number | null;
  capacity?: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateBatchSettings(batchId, new FormData(e.currentTarget));
      if (!res.success) {
        alert(res.error || "Failed to save");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-cyan-400 transition pt-1"
      >
        <span>
          Fee:{" "}
          {monthlyFee != null ? (
            <span className="text-zinc-200 font-medium">₹{monthlyFee.toLocaleString("en-IN")}/mo</span>
          ) : (
            <span className="text-amber-400">Set fee</span>
          )}
        </span>
        <Pencil className="w-3 h-3" />
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 pt-1">
      <label className="flex flex-col text-[10px] text-zinc-500 uppercase">
        Fee ₹/mo
        <input
          name="monthlyFee"
          type="number"
          min={0}
          step={1}
          defaultValue={monthlyFee ?? ""}
          className="w-24 mt-1 rounded-md bg-zinc-950 border border-zinc-800 px-2 py-1 text-sm text-zinc-100"
        />
      </label>
      <label className="flex flex-col text-[10px] text-zinc-500 uppercase">
        Capacity
        <input
          name="capacity"
          type="number"
          min={0}
          step={1}
          defaultValue={capacity ?? ""}
          className="w-20 mt-1 rounded-md bg-zinc-950 border border-zinc-800 px-2 py-1 text-sm text-zinc-100"
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-cyan-500 text-zinc-950 hover:bg-cyan-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
        Cancel
      </button>
    </form>
  );
}
