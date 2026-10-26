"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelAutopayMandate, createAutopayCharges, listAutopayMandates, retryAutopayCharge, syncAutopayMandate } from "@/app/actions/autopay";
import type { AutopayAdminRow } from "@/lib/autopay";

const inr = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN")}`;

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "text-emerald-600",
  PAUSED: "text-amber-600",
  AUTHENTICATED: "text-sky-600",
  CREATED: "text-ink-subtle",
  CANCELLED: "text-ink-subtle",
  EXPIRED: "text-ink-subtle",
  FAILED: "text-red-500",
};

function chargeLabel(c: NonNullable<AutopayAdminRow["lastCharge"]>): string {
  if (c.status === "SUBMIT_FAILED") return `${c.month}: not sent — ${c.failureReason ?? "error"}`;
  if (c.status === "PENDING_SUBMIT") return `${c.month}: being sent`;
  const p = c.paymentStatus;
  if (p === "PAID") return `${c.month}: ${inr(c.amountMinor)} received`;
  if (p === "FAILED") return `${c.month}: debit failed`;
  if (p === "NEEDS_REVIEW") return `${c.month}: needs review (possible duplicate)`;
  return `${c.month}: ${inr(c.amountMinor)} scheduled (pre-debit notice sent, debit in ~25h)`;
}

/** Fees → UPI AutoPay mandates (flag upiAutopay, fees.manage). */
export function AutopayMandatesPanel() {
  const [rows, setRows] = useState<AutopayAdminRow[]>([]);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await listAutopayMandates();
      if (!r.success) setError(r.error);
      else {
        setError(null);
        setRows(r.rows);
        setMonth(r.month);
      }
    } catch {
      setError("Couldn't load AutoPay mandates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(key);
    try {
      const r = await fn();
      if (!r.success) toast.error(r.error || "Something went wrong");
      else toast.success(ok);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function runCharges() {
    setBusy("run");
    try {
      const r = await createAutopayCharges();
      if (!r.success) toast.error(r.error);
      else toast.success(`Debits sent: ${r.submitted}. Failed: ${r.failed}. Skipped: ${r.skipped.length}.`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-subtle">Loading AutoPay…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  const active = rows.filter((r) => r.status === "ACTIVE").length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          {active} active mandate{active === 1 ? "" : "s"} · parents set this up from their app.
        </p>
        <Button type="button" size="sm" onClick={runCharges} disabled={busy !== null || active === 0}>
          {busy === "run" && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Send {month} debits
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-subtle">No parent has set up AutoPay yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink truncate">
                  {r.studentName}
                  {r.parentName && <span className="text-ink-subtle"> · {r.parentName}</span>}
                </p>
                <p className="text-xs truncate">
                  <span className={STATUS_TONE[r.status] ?? "text-ink-subtle"}>{r.statusLabel}</span>
                  <span className="text-ink-subtle"> · up to {inr(r.maxAmountMinor)}</span>
                </p>
                {r.lastCharge && <p className="text-xs text-ink-subtle truncate">{chargeLabel(r.lastCharge)}</p>}
              </div>
              {["AUTHENTICATED", "ACTIVE", "PAUSED"].includes(r.status) && (
                <Button type="button" size="sm" variant="ghost" aria-label="Refresh status" disabled={busy !== null} onClick={() => run(`s${r.id}`, () => syncAutopayMandate(r.id), "Status refreshed")}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
              {r.lastCharge?.status === "SUBMIT_FAILED" && (
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => run(`r${r.id}`, () => retryAutopayCharge(r.lastCharge!.id), "Debit re-sent")}>
                  Retry
                </Button>
              )}
              {["CREATED", "AUTHENTICATED", "ACTIVE", "PAUSED"].includes(r.status) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => confirm(`Cancel ${r.studentName}'s AutoPay mandate?`) && run(`c${r.id}`, () => cancelAutopayMandate(r.id), "Mandate cancelled")}
                >
                  Cancel
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
