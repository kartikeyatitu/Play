"use client";
// Fees screen helpers. The unpaid list itself (remind, remind all, mark paid, send receipt) is OverduePanel.

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { getRecentPaidFees, type RecentPaidFeeRow } from "@/app/actions/fees";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { useFormatMoney } from "@/lib/org-locale-context";

function formatMonth(m: string) {
  if (!m || !m.includes("-")) return m;
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Fees paid in the last 14 days. Bump `refreshKey` to reload after marking something paid. */
export function RecentlyPaid({ refreshKey = 0 }: { refreshKey?: number }) {
  const fmt = useFormatMoney();
  const [rows, setRows] = useState<RecentPaidFeeRow[]>([]);
  useEffect(() => {
    let live = true;
    getRecentPaidFees()
      .then((p) => {
        if (live && p.success) setRows(p.rows);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [refreshKey]);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="collect-fees-recent-paid">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">Recently paid</span>
        <span className="text-[11px] text-ink-subtle">· last 14 days</span>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-hairline">
        {rows.map((p) => (
          <li key={p.feeRecordId} className="p-3 sm:px-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 text-sm text-ink truncate">{p.studentName}</span>
            <span className="text-sm font-semibold text-ink num">{fmt(p.amount)}</span>
            <span className="text-[11px] text-ink-subtle">{formatMonth(p.month)}</span>
            <PaymentMethodBadge status="PAID" method={p.paymentMethod} />
          </li>
        ))}
      </ul>
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
