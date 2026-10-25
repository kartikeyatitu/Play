"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { MessageCircle, Check, Share2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { getUnpaidFees, resolvePayOption, getFeeReceiptToken, type UnpaidFeeRow } from "@/app/actions/fees";
import { markFeePaid } from "@/app/actions/payments";
import { buildReminderMessage } from "@/lib/pay-link";
import { shellButton } from "@/components/shell/EmptyState";
import { getAppUrl } from "@/lib/app-url";
import { useFormatMoney } from "@/lib/org-locale-context";

interface CollectFeesProps {
  academyName: string;
  upiId: string | null;
  razorpayConnected: boolean;
}

interface Bucket {
  key: string;
  label: string;
  rows: UnpaidFeeRow[];
}

function waLink(phone: string, text: string) {
  const clean = phone.replace(/\D/g, "");
  const wa = clean.length === 10 ? `91${clean}` : clean;
  return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
}

function formatMonth(m: string) {
  if (!m || !m.includes("-")) return m;
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function overdueTone(days: number): { chip: string; label: string } {
  if (days >= 30) return { chip: "bg-rose-500/10 text-danger border border-rose-500/20", label: `${days}d overdue` };
  if (days >= 7) return { chip: "bg-amber-500/10 text-warn border border-amber-500/20", label: `${days}d overdue` };
  if (days >= 0) return { chip: "bg-sky-500/10 text-sky-400 border border-sky-500/20", label: `This month` };
  return { chip: "bg-zinc-500/10 text-ink-subtle border border-line", label: `Future` };
}

function bucketOf(days: number): string {
  if (days >= 30) return "overdue30";
  if (days >= 7) return "overdue7";
  if (days >= 0) return "thisMonth";
  return "future";
}

const BUCKET_META: Record<string, { label: string; order: number }> = {
  overdue30: { label: "Overdue 30+ days", order: 0 },
  overdue7: { label: "Overdue 7-29 days", order: 1 },
  thisMonth: { label: "This month", order: 2 },
  future: { label: "Future", order: 3 },
};

export function CollectFees({ academyName, upiId, razorpayConnected }: CollectFeesProps) {
  const [rows, setRows] = useState<UnpaidFeeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRows, setBusyRows] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const fmt = useFormatMoney();

  const reload = () => {
    startTransition(async () => {
      const r = await getUnpaidFees();
      if (r.success) {
        setRows(r.rows);
        setError(null);
      } else {
        setError(r.error);
      }
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buckets: Bucket[] = useMemo(() => {
    if (!rows) return [];
    const groups: Record<string, UnpaidFeeRow[]> = {};
    for (const r of rows) {
      const k = bucketOf(r.overdueDays);
      (groups[k] ||= []).push(r);
    }
    return Object.entries(groups)
      .map(([key, rs]) => ({ key, label: BUCKET_META[key].label, rows: rs }))
      .sort((a, b) => BUCKET_META[a.key].order - BUCKET_META[b.key].order);
  }, [rows]);

  const totalUnpaid = rows?.reduce((s, r) => s + r.amount, 0) ?? 0;

  const sendReminder = async (row: UnpaidFeeRow) => {
    if (!row.parentPhone) {
      toast.error("No parent phone on file.");
      return;
    }
    setBusyRows((s) => ({ ...s, [row.feeRecordId]: true }));
    try {
      const r = await resolvePayOption(row.studentId, row.month, row.amount);
      const pay = r.success ? r.pay : { kind: "none" as const };
      const { text } = buildReminderMessage({
        parentName: row.parentName,
        studentName: row.studentName,
        amount: row.amount,
        month: row.month,
        academyName,
        pay,
      });
      window.open(waLink(row.parentPhone, text), "_blank");
    } finally {
      setBusyRows((s) => ({ ...s, [row.feeRecordId]: false }));
    }
  };

  const markPaid = async (row: UnpaidFeeRow) => {
    setBusyRows((s) => ({ ...s, [row.feeRecordId]: true }));
    // Optimistic: hide the row immediately.
    const prev = rows;
    setRows((rs) => (rs ? rs.filter((x) => x.feeRecordId !== row.feeRecordId) : rs));
    const r = await markFeePaid(row.studentId, row.month, `manual-${Date.now()}`);
    if (!r.success) {
      setRows(prev);
      toast.error(r.error || "Could not mark paid.");
    } else {
      toast.success(`${fmt(row.amount)} marked paid — ${row.studentName}`);
    }
    setBusyRows((s) => ({ ...s, [row.feeRecordId]: false }));
  };

  const shareReceipt = async (row: UnpaidFeeRow) => {
    // The row is unpaid, so there's no receipt yet. We offer a one-tap "mark paid + share" via two
    // steps: first mark paid (receipt is created server-side), then open WhatsApp with the image URL.
    setBusyRows((s) => ({ ...s, [row.feeRecordId]: true }));
    try {
      const r = await markFeePaid(row.studentId, row.month, `manual-${Date.now()}`);
      if (!r.success) {
        toast.error(r.error || "Could not record payment.");
        return;
      }
      const tokenRes = await getFeeReceiptToken(row.feeRecordId);
      if (!tokenRes.token) {
        toast.error("Receipt not generated yet.");
        return;
      }
      const url = `${getAppUrl()}/api/receipts/${tokenRes.token}/image`;
      const text = `Thank you ${row.parentName || ""}, we have received ${fmt(row.amount)} for ${row.studentName} (${formatMonth(row.month)}).\nReceipt: ${url}\n— ${academyName}`;
      if (row.parentPhone) window.open(waLink(row.parentPhone, text), "_blank");
      setRows((rs) => (rs ? rs.filter((x) => x.feeRecordId !== row.feeRecordId) : rs));
      toast.success("Receipt shared.");
    } finally {
      setBusyRows((s) => ({ ...s, [row.feeRecordId]: false }));
    }
  };

  if (error) {
    return <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">{error}</div>;
  }

  if (!rows) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-sm text-ink-subtle flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading unpaid fees…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/15 text-success grid place-items-center">
          <Check className="w-5 h-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-ink">All settled</p>
        <p className="mt-1 text-[13px] text-ink-subtle">No unpaid fees in your academy right now.</p>
      </div>
    );
  }

  const noPaymentMethod = !upiId && !razorpayConnected;

  return (
    <div id="collect-fees" className="space-y-6">
      {noPaymentMethod && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <span className="shrink-0 h-8 w-8 rounded-lg bg-amber-500/15 text-warn grid place-items-center text-sm font-bold">!</span>
          <div>
            <p className="text-sm font-medium text-ink">No payment method configured</p>
            <p className="text-[13px] text-ink-subtle mt-0.5">
              Parents can&apos;t pay online yet. Go to <strong>Settings</strong> and add your UPI ID or connect Razorpay so you can send payment links with fee reminders.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Collect fees</h3>
          <p className="text-[13px] text-ink-subtle">
            {rows.length} unpaid · {fmt(totalUnpaid)} outstanding
            {razorpayConnected ? " · Razorpay links on" : upiId ? " · UPI deep-links on" : ""}
          </p>
        </div>
      </div>

      {buckets.map((b) => (
        <div key={b.key} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">{b.label}</span>
            <span className="text-[11px] text-ink-subtle">· {b.rows.length}</span>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-hairline">
            {b.rows.map((row) => {
              const tone = overdueTone(row.overdueDays);
              const busy = !!busyRows[row.feeRecordId];
              return (
                <li key={row.feeRecordId} className="p-3 sm:p-4" data-testid={`collect-fee-row-${row.studentId}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{row.studentName}</p>
                      <p className="text-[12px] text-ink-subtle truncate">
                        {row.batchName ? `${row.batchName} · ` : ""}
                        {row.parentName || "No parent name"}
                        {row.parentPhone ? ` · ${row.parentPhone}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <span className="text-sm font-semibold text-ink num">{fmt(row.amount)}</span>
                      <span className="text-[11px] text-ink-subtle">{formatMonth(row.month)}</span>
                      <span className={`text-[11px] rounded-full px-2 py-0.5 ${tone.chip}`}>{tone.label}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <button
                        type="button"
                        onClick={() => sendReminder(row)}
                        disabled={busy || !row.parentPhone}
                        className={`${shellButton.quiet} !px-3 !py-1.5 !min-h-[36px] text-[12px]`}
                        data-testid="collect-fee-whatsapp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Remind</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => markPaid(row)}
                        disabled={busy}
                        className={`${shellButton.primary} !px-3 !py-1.5 !min-h-[36px] text-[12px]`}
                        data-testid="collect-fee-mark-paid"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Mark paid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => shareReceipt(row)}
                        disabled={busy || !row.parentPhone}
                        className={`${shellButton.quiet} !px-3 !py-1.5 !min-h-[36px] text-[12px]`}
                        title="Mark paid & share receipt on WhatsApp"
                        data-testid="collect-fee-share-receipt"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Share receipt</span>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Compact banner for the Today screen: a prominent "Collect fees (N due)" button. */
export function CollectFeesBanner({ onNavigate, count, amount }: { onNavigate: (tab: string) => void; count: number; amount: number }) {
  const fmt = useFormatMoney();
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => onNavigate("fees")}
      className="group block w-full text-left rounded-xl border border-volt/40 bg-volt/10 hover:bg-volt/15 shadow-hairline transition-colors px-4 py-3 flex items-center justify-between gap-3"
      data-testid="today-collect-fees-button"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="h-9 w-9 rounded-lg bg-volt text-volt-fg grid place-items-center shrink-0">
          <FileText className="w-4 h-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Collect fees ({count} due)</span>
          <span className="block text-[12px] text-ink-muted truncate">{fmt(amount)} outstanding · tap to review and remind</span>
        </span>
      </span>
      <span className="text-[12px] text-ink-subtle shrink-0">Open ›</span>
    </button>
  );
}
