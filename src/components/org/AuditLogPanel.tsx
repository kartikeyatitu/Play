"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportAuditLogCsv, listAuditLog } from "@/app/actions/audit";

type Row = { id: string; action: string; createdAt: string; userName: string | null; userRole: string | null; details: Record<string, unknown> | null };

function detailText(d: Record<string, unknown> | null): string {
  if (!d) return "";
  return Object.entries(d)
    .map(([k, v]) => `${k}: ${v !== null && typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

/** Owner-only audit history: filter by action and dates, page through, export CSV. */
export function AuditLogPanel() {
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (append: boolean, after: string | null) => {
      append ? setMore(true) : setLoading(true);
      setError(null);
      try {
        const res = await listAuditLog({ action, from, to, cursor: after });
        if (!res.success) {
          setError(res.error);
          if (!append) setRows([]);
          return;
        }
        setRows((cur) => (append ? [...cur, ...res.rows] : res.rows));
        setCursor(res.nextCursor);
      } catch {
        setError("Couldn't load the audit log.");
      } finally {
        setLoading(false);
        setMore(false);
      }
    },
    [action, from, to],
  );

  useEffect(() => {
    load(false, null);
    // Initial load only; filters apply on submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onExport() {
    setExporting(true);
    try {
      const res = await exportAuditLogCsv({ action, from, to });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.count} rows${res.truncated ? " (limit reached — narrow the dates for the rest)" : ""}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface shadow-hairline p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-ink">Audit log</h3>
        <p className="text-xs text-ink-subtle">Every recorded change in your academy, newest first. Only the owner can see or export this.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(false, null);
        }}
        className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] items-end"
      >
        <label className="text-xs text-ink-muted space-y-1">
          Action starts with
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. FEE, BATCH, BRANCH" maxLength={60} />
        </label>
        <label className="text-xs text-ink-muted space-y-1">
          From
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-ink-muted space-y-1">
          To
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Button type="submit" variant="outline">Filter</Button>
        <Button type="button" onClick={onExport} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-1" />} CSV
        </Button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-ink-subtle">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-subtle">No matching activity.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="py-2 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm text-ink">
                  <span className="font-mono text-xs mr-2">{r.action}</span>
                  <span className="text-ink-muted">{r.userName ?? "Unknown user"}</span>
                </p>
                <time className="text-xs text-ink-subtle" dateTime={r.createdAt}>
                  {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </div>
              {r.details && <p className="text-xs text-ink-subtle break-words">{detailText(r.details)}</p>}
            </li>
          ))}
        </ul>
      )}
      {cursor && !loading && (
        <Button type="button" variant="outline" onClick={() => load(true, cursor)} disabled={more}>
          {more ? "Loading…" : "Load more"}
        </Button>
      )}
    </section>
  );
}
