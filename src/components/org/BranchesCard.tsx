"use client";

import { useEffect, useState } from "react";
import { MapPin, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listBranches, createBranch, deleteBranch } from "@/app/actions/branches";

type BranchRow = { id: string; name: string; address: string | null; city: string | null; batchCount: number };

/** Academy settings: manage physical locations (branches). Owner-only writes (settings.manage). */
export function BranchesCard() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const res = await listBranches();
    if (res.success) setBranches(res.branches);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(formData: FormData) {
    setSaving(true);
    try {
      const res = await createBranch(formData);
      if (!res.success) {
        toast.error(res.error || "Could not add branch");
        return;
      }
      toast.success("Branch added");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(b: BranchRow) {
    const note = b.batchCount > 0 ? ` Its ${b.batchCount} batch(es) will stay, without a branch.` : "";
    if (!confirm(`Delete branch "${b.name}"?${note}`)) return;
    setBusyId(b.id);
    try {
      const res = await deleteBranch(b.id);
      if (!res.success) toast.error(res.error || "Could not delete branch");
      else toast.success("Branch deleted");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface shadow-hairline p-6">
      <div className="flex items-start gap-3 mb-4">
        <MapPin className="w-5 h-5 text-ink-muted mt-0.5 shrink-0" aria-hidden />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-ink">Branches</h3>
          <p className="text-xs text-ink-subtle">
            Locations where your academy runs batches. Optional — skip this if you have one centre.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-subtle">Loading…</p>
      ) : branches.length === 0 ? (
        <p className="text-sm text-ink-subtle mb-4">No branches yet.</p>
      ) : (
        <ul className="divide-y divide-line mb-4">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{b.name}</p>
                <p className="text-xs text-ink-subtle truncate">
                  {[b.address, b.city].filter(Boolean).join(", ") || "No address"} · {b.batchCount}{" "}
                  {b.batchCount === 1 ? "batch" : "batches"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(b)}
                disabled={busyId === b.id}
                aria-label={`Delete ${b.name}`}
                className="p-2 rounded-md text-ink-muted hover:text-red-500 disabled:opacity-50"
              >
                {busyId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={onCreate} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Input name="name" placeholder="Branch name" required minLength={2} maxLength={80} />
        <Input name="address" placeholder="Address (optional)" maxLength={240} />
        <Input name="city" placeholder="City (optional)" maxLength={80} />
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add branch"}
        </Button>
      </form>
    </section>
  );
}
