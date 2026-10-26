"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { issueGstCreditNote, issueGstInvoice, listGstDocuments } from "@/app/actions/gst-invoices";
import { GST_STATE_CODES, formatMinorINR, type GstDocRow, type UninvoicedFeeRow } from "@/lib/gst";

const STATES = Object.entries(GST_STATE_CODES).sort((a, b) => a[1].localeCompare(b[1]));

/** Fees → GST invoices (flag gstInvoices): issue invoices for paid fees, print, credit notes. */
export function GstInvoicesPanel({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [supplierState, setSupplierState] = useState<string | null>(null);
  const [canCredit, setCanCredit] = useState(false);
  const [docs, setDocs] = useState<GstDocRow[]>([]);
  const [uninvoiced, setUninvoiced] = useState<UninvoicedFeeRow[]>([]);
  const [pos, setPos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await listGstDocuments();
      if (!r.success) {
        setError(r.error);
        return;
      }
      setError(null);
      setProfileReady(r.profileReady);
      setSupplierState(r.supplierStateCode);
      setCanCredit(r.canCredit);
      setDocs(r.documents);
      setUninvoiced(r.uninvoiced);
    } catch {
      setError("Couldn't load GST invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function issue(feeRecordId: string) {
    setBusy(feeRecordId);
    try {
      const r = await issueGstInvoice(feeRecordId, pos[feeRecordId] || null);
      if (!r.success) toast.error(r.error);
      else toast.success(r.existed ? `Invoice ${r.number} already exists` : `Invoice ${r.number} issued`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function credit(doc: GstDocRow) {
    const reason = prompt(`Reason for the credit note against ${doc.number} (e.g. refund):`);
    if (!reason) return;
    setBusy(doc.id);
    try {
      const r = await issueGstCreditNote(doc.id, reason);
      if (!r.success) toast.error(r.error);
      else toast.success(`Credit note ${r.number} issued`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-subtle">Loading GST invoices…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <section className="space-y-5">
      {!profileReady && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-600">
          Add your GST details first{" "}
          {onOpenSettings && (
            <button type="button" className="underline" onClick={onOpenSettings}>
              in Settings
            </button>
          )}
          .
        </p>
      )}

      <div>
        <h4 className="text-sm font-semibold text-ink mb-2">Paid fees without an invoice ({uninvoiced.length})</h4>
        {uninvoiced.length === 0 ? (
          <p className="text-xs text-ink-subtle">Every paid fee in the last 100 days has an invoice.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {uninvoiced.slice(0, 50).map((f) => (
              <li key={f.feeRecordId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{f.studentName}</p>
                  <p className="text-xs text-ink-subtle">
                    {f.month} · ₹{f.amount.toLocaleString("en-IN")}
                  </p>
                </div>
                <select
                  aria-label="Place of supply"
                  value={pos[f.feeRecordId] ?? ""}
                  onChange={(e) => setPos((p) => ({ ...p, [f.feeRecordId]: e.target.value }))}
                  className="h-8 max-w-[11rem] rounded-md border border-line bg-surface px-1 text-xs text-ink"
                >
                  <option value="">Place of supply: {supplierState ? GST_STATE_CODES[supplierState] : "academy state"}</option>
                  {STATES.map(([code, name]) => (
                    <option key={code} value={code}>{code} {name}</option>
                  ))}
                </select>
                <Button type="button" size="sm" disabled={!profileReady || busy === f.feeRecordId} onClick={() => issue(f.feeRecordId)}>
                  {busy === f.feeRecordId ? <Loader2 className="w-3 h-3 animate-spin" /> : "Issue"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink mb-2">Issued documents</h4>
        {docs.length === 0 ? (
          <p className="text-xs text-ink-subtle">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <FileText className="w-4 h-4 text-ink-muted shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">
                    <span className="font-mono">{d.number}</span>
                    {d.kind === "CREDIT_NOTE" && <span className="ml-2 text-xs text-rose-500">Credit note</span>}
                    {d.credited && <span className="ml-2 text-xs text-ink-subtle">(credited)</span>}
                  </p>
                  <p className="text-xs text-ink-subtle truncate">
                    {d.issueDay} · {d.studentName ?? d.recipientName} · {formatMinorINR(d.totalMinor)}
                  </p>
                </div>
                <a href={`/org/invoices/${d.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
                  <Printer className="w-3.5 h-3.5" /> Print
                </a>
                {canCredit && d.kind === "INVOICE" && !d.credited && (
                  <Button type="button" size="sm" variant="outline" disabled={busy === d.id} onClick={() => credit(d)}>
                    Credit note
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
