"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageCircle, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { getOverdueAging } from "@/app/actions/fees";
import { recordFamilyFeeReminder, startBucketReminders } from "@/app/actions/reminders";
import { useFormatMoney } from "@/lib/org-locale-context";
import type { OverdueBucketView, OverdueFamilyView, OverdueView } from "@/lib/fee-overdue-server";

function monthLabel(m: string) {
  const [y, mo] = (m || "").split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function ago(iso: string | null) {
  if (!iso) return null;
  const h = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
  if (h < 1) return "reminded just now";
  if (h < 24) return `reminded ${h}h ago`;
  return `reminded ${Math.floor(h / 24)}d ago`;
}

const TONE: Record<string, string> = {
  d0_7: "text-ink",
  d8_15: "text-warn",
  d16_30: "text-warn",
  d30_plus: "text-danger",
};

/**
 * Overdue fees by age (0–7, 8–15, 16–30, 30+ days, academy-local). Tap a bucket to see its families,
 * largest amount first; remind one family with one tap, or walk the whole bucket with "Remind all".
 */
export function OverduePanel() {
  const fmt = useFormatMoney();
  const [view, setView] = useState<OverdueView | null>(null);
  const [canRemind, setCanRemind] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("d30_plus");
  const [queue, setQueue] = useState<{ bucket: string; families: OverdueFamilyView[]; index: number } | null>(null);
  const [loading, startLoading] = useTransition();
  const [starting, setStarting] = useState(false);

  const load = () =>
    startLoading(async () => {
      const r = await getOverdueAging();
      if (!r.success) {
        setError(r.error);
        return;
      }
      setError(null);
      setView(r.view);
      setCanRemind(r.canRemind);
      // Open the oldest bucket that has something in it.
      const firstWithDues = [...r.view.buckets].reverse().find((b) => b.total > 0);
      if (firstWithDues) setActive((cur) => (r.view.buckets.find((b) => b.key === cur)?.total ? cur : firstWithDues.key));
    });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markReminded = (familyId: string, at: string) =>
    setView((v) =>
      v
        ? { ...v, buckets: v.buckets.map((b) => ({ ...b, families: b.families.map((f) => (f.familyId === familyId ? { ...f, lastRemindedAt: at } : f)) })) }
        : v,
    );

  // The <a> opens WhatsApp synchronously (no popup blocker); recording happens alongside.
  const onRemind = (family: OverdueFamilyView, bucket: string) => {
    recordFamilyFeeReminder(family.familyId, bucket)
      .then((r) => {
        if (r.success) markReminded(family.familyId, r.remindedAt);
        else toast.error(r.error);
      })
      .catch(() => toast.error("Reminder opened, but it could not be recorded."));
  };

  const startAll = async (bucket: OverdueBucketView) => {
    setStarting(true);
    try {
      const r = await startBucketReminders(bucket.key);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      const skipped = [
        r.skippedRecent ? `${r.skippedRecent} reminded in the last 20h` : "",
        r.skippedNoPhone ? `${r.skippedNoPhone} without a phone` : "",
        r.skippedOverLimit ? `${r.skippedOverLimit} over the 40-family limit` : "",
      ].filter(Boolean);
      if (!r.send.length) {
        toast.info(skipped.length ? `Nobody to remind: ${skipped.join(", ")}.` : "Nobody to remind.");
        return;
      }
      if (skipped.length) toast.info(`Skipping ${skipped.join(", ")}.`);
      setQueue({ bucket: bucket.key, families: r.send, index: 0 });
    } finally {
      setStarting(false);
    }
  };

  if (error) return <div className="rounded-xl border border-line bg-surface p-4 text-sm text-danger">{error}</div>;
  if (!view) {
    return <div className="h-28 rounded-xl border border-line bg-surface animate-pulse" aria-busy="true" />;
  }

  const bucket = view.buckets.find((b) => b.key === active) ?? view.buckets[0];
  const current = queue ? queue.families[queue.index] : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {view.buckets.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setActive(b.key)}
            aria-pressed={b.key === active}
            className={`rounded-xl border p-3 text-left transition-colors ${
              b.key === active ? "border-volt bg-surface-2" : "border-line bg-surface hover:bg-surface-2"
            }`}
          >
            <div className="text-xs text-ink-subtle">{b.label}</div>
            <div className={`mt-1 text-lg font-semibold tabular-nums ${b.total > 0 ? TONE[b.key] : "text-ink-subtle"}`}>{fmt(b.total)}</div>
            <div className="text-xs text-ink-muted">
              {b.familyCount} {b.familyCount === 1 ? "family" : "families"} · {b.recordCount} {b.recordCount === 1 ? "fee" : "fees"}
            </div>
          </button>
        ))}
      </div>

      {queue && current && (
        <div className="rounded-xl border border-volt bg-surface-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-ink-subtle">
                Reminding {queue.index + 1} of {queue.families.length}
              </div>
              <div className="truncate font-medium text-ink">{current.familyName || "Parent"}</div>
              <div className="text-sm text-ink-muted">{fmt(current.total)} overdue</div>
            </div>
            <button type="button" onClick={() => setQueue(null)} className="rounded-md p-1 text-ink-subtle hover:text-ink" aria-label="Stop reminding">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            {current.waLink && (
              <a
                href={current.waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  onRemind(current, queue.bucket);
                  setQueue((q) => (q && q.index + 1 < q.families.length ? { ...q, index: q.index + 1 } : null));
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-volt px-4 py-2.5 text-sm font-medium text-volt-fg"
              >
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => setQueue((q) => (q && q.index + 1 < q.families.length ? { ...q, index: q.index + 1 } : null))}
              className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink-muted hover:text-ink"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="font-medium text-ink">{bucket.label} overdue</div>
            <div className="text-xs text-ink-subtle">Largest amount first · as of {view.today}</div>
          </div>
          {canRemind && bucket.families.length > 0 && (
            <button
              type="button"
              disabled={starting || Boolean(queue)}
              onClick={() => startAll(bucket)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-surface-2 disabled:opacity-50"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Remind all
            </button>
          )}
        </div>

        {!canRemind && (
          <p className="px-4 py-6 text-sm text-ink-muted">Family details and reminders need the “Record payments” permission.</p>
        )}
        {canRemind && bucket.families.length === 0 && (
          <p className="px-4 py-6 text-sm text-ink-muted">{loading ? "Loading…" : "Nothing overdue in this range."}</p>
        )}
        {canRemind && bucket.families.length > 0 && (
          <ul className="divide-y divide-line">
            {bucket.families.map((f) => (
              <li key={f.familyId} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{f.familyName || "Parent"}</div>
                  <div className="text-xs text-ink-muted">
                    {f.lines.map((l) => `${l.studentName} · ${monthLabel(l.month)}`).join(", ")}
                  </div>
                  <div className="text-xs text-ink-subtle">
                    {f.maxDaysOverdue}d overdue{f.lastRemindedAt ? ` · ${ago(f.lastRemindedAt)}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`font-semibold tabular-nums ${TONE[bucket.key]}`}>{fmt(f.total)}</span>
                  {f.waLink ? (
                    <a
                      href={f.waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onRemind(f, bucket.key)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink hover:bg-surface-2"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Remind
                    </a>
                  ) : (
                    <span className="text-xs text-ink-subtle">No phone</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
