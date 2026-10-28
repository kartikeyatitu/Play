"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAiStatus, readRegisterPhoto } from "@/app/actions/ai";
import { importStudents } from "@/app/actions/import";
import { registerRowProblem, type RegisterRow } from "@/lib/ai/register";

type Batch = { id: string; name: string };
type ReviewRow = RegisterRow & { key: string; batchId: string; feeChoice: "" | "PAID" | "PENDING" };
type ImportResult = { created: number; skipped: number; errors: { row: number; name: string; reason: string }[] };

const MAX_SIDE = 1600;

/** Shrink a camera photo to a JPEG under ~1 MB before upload (server actions have a body limit). */
async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not prepare the photo");
  return new File([blob], "register.jpg", { type: "image/jpeg" });
}

function matchBatch(read: string, batches: Batch[]): string {
  const name = read.trim().toLowerCase();
  if (!name) return "";
  const exact = batches.find((b) => b.name.toLowerCase() === name);
  if (exact) return exact.id;
  const partial = batches.find((b) => b.name.toLowerCase().includes(name) || name.includes(b.name.toLowerCase()));
  return partial?.id ?? "";
}

const field = "h-9 w-full rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-volt";

export function RegisterPhotoImport({ batches = [] }: { batches?: Batch[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    getAiStatus("students.manage")
      .then((r) => setAvailable(r.available))
      .catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  function reset() {
    setRows([]);
    setError("");
    setResult(null);
    setTruncated(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onPhoto(file: File | undefined) {
    if (!file || reading) return;
    reset();
    setReading(true);
    try {
      const small = await shrinkPhoto(file);
      const fd = new FormData();
      fd.append("photo", small);
      const res = await readRegisterPhoto(fd);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setTruncated(res.truncated);
      setRows(
        res.rows.map((r, i) => ({ ...r, key: `r${i}`, batchId: matchBatch(r.batchName, batches), feeChoice: "" })),
      );
    } catch {
      setError("Couldn't read that photo. Please try another one.");
    } finally {
      setReading(false);
    }
  }

  function update(key: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const ready = rows.filter((r) => !registerRowProblem(r));

  async function runImport() {
    if (importing || ready.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const batchName = (id: string) => batches.find((b) => b.id === id)?.name;
      const res = await importStudents(
        ready.map((r) => ({
          studentName: r.studentName.trim(),
          parentName: r.parentName.trim(),
          parentPhone: r.parentPhone.trim(),
          ...(r.batchId ? { batchName: batchName(r.batchId) } : {}),
          ...(r.feeChoice ? { feeStatus: r.feeChoice } : {}),
        })),
      );
      if (res.success) {
        setResult({ created: res.created ?? 0, skipped: res.skipped ?? 0, errors: res.errors ?? [] });
        setRows([]);
        router.refresh();
      } else {
        setError(res.error || "Import failed.");
      }
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line bg-surface text-xs sm:text-sm font-medium text-ink hover:bg-surface-2"
      >
        <Camera className="w-4 h-4 text-volt" />
        Scan paper register
      </button>

      <Dialog open={open} onOpenChange={(o) => !reading && !importing && setOpen(o)}>
        <DialogContent className="bg-surface border-line text-ink w-[calc(100vw-2rem)] max-w-3xl rounded-2xl p-0 max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-line">
            <DialogTitle className="text-lg font-semibold text-ink">Scan a paper register</DialogTitle>
            <p className="text-xs text-ink-muted">
              Take a clear photo of one page. AI reads the names and numbers; you check every row before anything is added.
            </p>
          </DialogHeader>

          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {result ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <CheckCircle2 className="w-5 h-5 text-success" /> Added {result.created} student{result.created === 1 ? "" : "s"}
                  {result.skipped > 0 && <span className="font-normal text-ink-muted">· {result.skipped} skipped</span>}
                </p>
                {result.errors.length > 0 && (
                  <ul className="space-y-1 text-sm text-ink-muted">
                    {result.errors.map((e) => (
                      <li key={`${e.row}-${e.name}`}>
                        <span className="text-ink">{e.name}</span>: {e.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={reset} className="h-9 px-3 rounded-lg border border-line text-sm text-ink hover:bg-surface-2">
                  Scan another page
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="space-y-3">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  id="register-photo"
                  onChange={(e) => onPhoto(e.target.files?.[0])}
                  disabled={reading}
                />
                <label
                  htmlFor="register-photo"
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center cursor-pointer hover:bg-surface-2 ${reading ? "pointer-events-none opacity-70" : ""}`}
                >
                  {reading ? <Loader2 className="w-7 h-7 animate-spin text-ink-muted" /> : <Camera className="w-7 h-7 text-volt" />}
                  <span className="text-sm font-medium text-ink">{reading ? "Reading the register…" : "Take or choose a photo"}</span>
                  <span className="text-xs text-ink-subtle">Flat page, good light, all columns visible</span>
                </label>
                <p className="text-xs text-ink-subtle">
                  The photo is sent to our AI provider only to read it, and isn&apos;t stored by TRIQ.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-ink-muted">
                  {rows.length} row{rows.length === 1 ? "" : "s"} read · {ready.length} ready to add. Check each one against the register.
                  {truncated && " Only the first 200 rows were read; scan the rest separately."}
                </p>
                <ul className="space-y-3">
                  {rows.map((r) => {
                    const problem = registerRowProblem(r);
                    return (
                      <li key={r.key} className={`rounded-xl border p-3 space-y-2 ${problem ? "border-warn/50" : "border-line"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {problem ? (
                              <span className="inline-flex items-center gap-1 text-warn"><AlertTriangle className="w-3.5 h-3.5" /> {problem}</span>
                            ) : r.unclear ? (
                              <span className="inline-flex items-center gap-1 text-warn"><AlertTriangle className="w-3.5 h-3.5" /> Hard to read: double-check</span>
                            ) : (
                              <span className="text-ink-subtle">Looks complete</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                            className="p-1.5 rounded-md text-ink-subtle hover:text-danger hover:bg-surface-2"
                            aria-label={`Remove ${r.studentName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <input className={field} value={r.studentName} onChange={(e) => update(r.key, { studentName: e.target.value })} placeholder="Student name" aria-label="Student name" />
                          <input className={field} value={r.parentName} onChange={(e) => update(r.key, { parentName: e.target.value })} placeholder="Parent name" aria-label="Parent name" />
                          <input className={field} value={r.parentPhone} onChange={(e) => update(r.key, { parentPhone: e.target.value })} placeholder="Parent mobile" inputMode="tel" aria-label="Parent mobile" />
                          <select className={field} value={r.batchId} onChange={(e) => update(r.key, { batchId: e.target.value })} aria-label="Batch">
                            <option value="">No batch yet</option>
                            {batches.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <select className={field} value={r.feeChoice} onChange={(e) => update(r.key, { feeChoice: e.target.value as ReviewRow["feeChoice"] })} aria-label="This month's fee">
                            <option value="">Don&apos;t record a fee</option>
                            <option value="PAID">Fee paid this month</option>
                            <option value="PENDING">Fee due this month</option>
                          </select>
                          <p className="text-xs text-ink-subtle self-center">
                            {r.batchName && <>Register says batch “{r.batchName}”. </>}
                            {r.feeStatus && <>Register says {r.feeStatus === "PAID" ? "paid" : "unpaid"}.</>}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>

          {rows.length > 0 && !result && (
            <div className="p-4 border-t border-line flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={reset} disabled={importing} className="h-10 px-3 rounded-lg border border-line text-sm text-ink hover:bg-surface-2">
                Start over
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={importing || ready.length === 0}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-volt text-volt-fg text-sm font-semibold hover:bg-volt/90 disabled:opacity-50"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Add {ready.length} student{ready.length === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
