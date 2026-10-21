"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmFeePayment, rejectFeePayment } from "@/app/actions/payments";
import { Check, X, Loader2, Clock } from "lucide-react";
import { useFormatMoney } from "@/lib/org-locale-context";

type PendingItem = {
  id: string;
  month: string;
  amount: number;
  student?: { id?: string; name?: string | null; parent?: { name?: string | null; phone?: string | null } | null } | null;
};

/** Admin list of parent-reported UPI payments awaiting confirmation. */
export function PendingPayments({ items }: { items: PendingItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const fmt = useFormatMoney();

  async function act(id: string, kind: "confirm" | "reject") {
    if (kind === "reject" && !confirm("Mark this payment as NOT received? The parent will see it as pending again.")) return;
    setBusy(id);
    try {
      const res = kind === "confirm" ? await confirmFeePayment(id) : await rejectFeePayment(id);
      if (!res.success) alert(res.error || "Failed to update");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!items?.length) {
    return (
      <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-4 text-sm text-zinc-500">
        No payments awaiting confirmation. When a parent taps &quot;I&apos;ve paid&quot;, it will show up here.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 divide-y divide-zinc-800/50">
      {items.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-zinc-200 font-medium truncate">
                {f.student?.name || "Student"} · {fmt(f.amount || 0)} · {f.month}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                Reported paid by {f.student?.parent?.name || "parent"}
                {f.student?.parent?.phone ? ` (${f.student.parent.phone})` : ""} — check your UPI app before confirming.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy === f.id}
              onClick={() => act(f.id, "confirm")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Received
            </button>
            <button
              type="button"
              disabled={busy === f.id}
              onClick={() => act(f.id, "reject")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              <X className="w-3 h-3" /> Not received
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
