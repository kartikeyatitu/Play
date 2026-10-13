"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { importStudents } from "@/app/actions/import";
import { cleanIndianPhone, parseDob } from "@/lib/import-utils";

type Step = 1 | 2 | 3;

type FieldKey = "studentName" | "parentName" | "parentPhone" | "dob" | "batchName" | "sport" | "feeStatus" | "bloodGroup";

const APP_FIELDS: { key: FieldKey; label: string; required: boolean }[] = [
  { key: "studentName", label: "Student Name", required: true },
  { key: "parentName", label: "Parent Name", required: true },
  { key: "parentPhone", label: "Parent Phone", required: true },
  { key: "dob", label: "Date of Birth", required: false },
  { key: "batchName", label: "Batch Name", required: false },
  { key: "sport", label: "Sport", required: false },
  { key: "feeStatus", label: "Fee Status (Paid/Pending)", required: false },
  { key: "bloodGroup", label: "Blood Group", required: false },
];

const CHUNK = 100; // rows per server call keeps each request well inside the serverless time limit

/** Guess which of our fields a spreadsheet header means. Order matters: "parent phone" is a phone, not a name. */
function guessMapping(header: string): FieldKey | null {
  const h = header.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!h) return null;
  if (/(phone|mobile|contact|whatsapp|\bcell\b)/.test(h)) return "parentPhone";
  if (/(dob|birth|b day|birthday)/.test(h)) return "dob";
  if (/(blood)/.test(h)) return "bloodGroup";
  if (/(fee|payment|paid|dues)/.test(h)) return "feeStatus";
  if (/(batch|group|class|timing|slot)/.test(h)) return "batchName";
  if (/^(sport|game|discipline)s?$/.test(h)) return "sport";
  if (/(parent|father|mother|guardian|mom|dad)/.test(h)) return "parentName";
  if (/(student|child|player|kid|trainee|athlete)/.test(h) || h === "name" || h === "full name") return "studentName";
  return null;
}

type Parsed = { fileRow: number; data: Partial<Record<FieldKey, string>>; problems: string[]; name: string };

const TEMPLATE_CSV =
  "Student Name,Parent Name,Parent Phone,Date of Birth (DD/MM/YYYY),Batch Name,Sport,Fee Status,Blood Group\n" +
  "Aarav Sharma,Rohit Sharma,9876543210,14/03/2014,U-14 Evening,Cricket,Pending,B+\n" +
  "Diya Verma,Neha Verma,9811122233,02/09/2012,Junior Morning,Badminton,Paid,O+\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "triq-student-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ExcelImport({ embedded = false, onDone }: { embedded?: boolean; onDone?: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [rawData, setRawData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<(FieldKey | null)[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: { row: number; name: string; reason: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      // xlsx is large (~400KB): load it only when a file is actually picked.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as any[][];
      if (rows.length < 2) {
        toast.error("That file has no student rows. Download the template to see the format.");
        return;
      }
      const hdrs = (rows[0] as any[]).map((h) => String(h ?? "").trim());
      const body = rows.slice(1).filter((r) => r.some((c) => c !== null && String(c).trim() !== ""));
      if (body.length === 0) {
        toast.error("That file has no student rows.");
        return;
      }
      // Auto-map, but never map two columns to the same field.
      const used = new Set<FieldKey>();
      const guessed = hdrs.map((h) => {
        const g = guessMapping(h);
        if (g && !used.has(g)) {
          used.add(g);
          return g;
        }
        return null;
      });
      setFileName(file.name);
      setHeaders(hdrs);
      setRawData(body);
      setMapping(guessed);
      setStep(2);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Couldn't read that file. Use .xlsx, .xls or .csv.");
    }
  };

  const setMap = (idx: number, key: FieldKey | null) =>
    setMapping((prev) => prev.map((m, i) => (i === idx ? key : key && m === key ? null : m)));

  const allRequiredMapped = APP_FIELDS.filter((f) => f.required).every((f) => mapping.includes(f.key));

  const parsed: Parsed[] = useMemo(() => {
    const seen = new Set<string>();
    return rawData.map((row, i) => {
      const data: Partial<Record<FieldKey, string>> = {};
      mapping.forEach((m, idx) => {
        if (m) data[m] = String(row[idx] ?? "").trim();
      });
      const problems: string[] = [];
      if (!data.studentName) problems.push("Missing student name");
      if (!data.parentName) problems.push("Missing parent name");
      if (!cleanIndianPhone(data.parentPhone)) problems.push(`Invalid phone "${data.parentPhone ?? ""}"`);
      if (data.dob && !parseDob(data.dob)) problems.push(`Unreadable date of birth "${data.dob}"`);
      const key = `${cleanIndianPhone(data.parentPhone)}|${(data.studentName ?? "").toLowerCase()}`;
      if (!problems.length) {
        if (seen.has(key)) problems.push("Duplicate of an earlier row in this file");
        seen.add(key);
      }
      return { fileRow: i + 1, data, problems, name: data.studentName || "(no name)" };
    });
  }, [rawData, mapping]);

  const valid = parsed.filter((p) => p.problems.length === 0);
  const invalid = parsed.filter((p) => p.problems.length > 0);

  const reset = () => {
    setStep(1);
    setRawData([]);
    setHeaders([]);
    setMapping([]);
    setResult(null);
    setProgress(0);
    setFileName("");
  };

  const handleImport = async () => {
    if (importing || valid.length === 0) return;
    setImporting(true);
    setProgress(0);
    let created = 0;
    let skipped = invalid.length;
    const errors: { row: number; name: string; reason: string }[] = invalid.map((p) => ({ row: p.fileRow, name: p.name, reason: p.problems[0] }));
    try {
      for (let i = 0; i < valid.length; i += CHUNK) {
        const chunk = valid.slice(i, i + CHUNK);
        const res = await importStudents(chunk.map((c) => c.data) as any);
        if (!res.success) {
          toast.error(res.error || "Import stopped. Rows imported so far are saved.");
          break;
        }
        created += res.created ?? 0;
        skipped += res.skipped ?? 0;
        for (const er of res.errors ?? []) {
          // server row numbers are positions inside this chunk: map back to the spreadsheet row
          errors.push({ row: chunk[er.row - 1]?.fileRow ?? er.row, name: er.name, reason: er.reason });
        }
        setProgress(Math.min(100, Math.round(((i + chunk.length) / valid.length) * 100)));
      }
      errors.sort((a, b) => a.row - b.row);
      setResult({ created, skipped, errors });
      if (created > 0) {
        toast.success(`${created} student${created === 1 ? "" : "s"} imported`);
        onDone?.();
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Import was interrupted. Students imported so far are saved: re-run the file and duplicates will be skipped.");
    } finally {
      setImporting(false);
    }
  };

  const body = (
    <>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {["Upload", "Match columns", "Review & import"].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > i + 1 ? "bg-emerald-500 text-white" : step === i + 1 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500" : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={`text-xs sm:text-sm ${step === i + 1 ? "text-white" : "text-zinc-500"}`}>{label}</span>
            {i < 2 && <div className={`w-4 sm:w-8 h-px ${step > i + 1 ? "bg-emerald-500" : "bg-zinc-800"}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <div
            className="border-2 border-dashed border-zinc-800 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center gap-3 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-base">Choose your Excel / CSV file</h3>
              <p className="text-zinc-500 text-sm mt-1">.xlsx, .xls or .csv · up to a few thousand students</p>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          </div>
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
            <Download className="w-4 h-4" /> Download a ready-to-fill template
          </button>
          <p className="text-xs text-zinc-500">
            Needed per student: name, parent name and a 10-digit parent mobile. Optional: date of birth, batch (created if new), sport, fee status, blood group. Any column order works; we&apos;ll match
            the columns for you.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <p className="text-zinc-400 text-sm">
              <span className="text-zinc-200 font-medium">{fileName}</span> · {rawData.length} rows
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Change file</Button>
              <Button onClick={() => setStep(3)} disabled={!allRequiredMapped} className="bg-emerald-600 hover:bg-emerald-700">
                Review
              </Button>
            </div>
          </div>
          {!allRequiredMapped && <p className="text-rose-400 text-sm">Match the starred fields (Student, Parent, Phone) to continue.</p>}
          <div className="grid gap-2">
            {headers.map((h, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-300 truncate">{h || `Column ${i + 1}`}</p>
                  <p className="text-xs text-zinc-500 truncate">e.g. {String(rawData[0]?.[i] ?? "—") || "—"}</p>
                </div>
                <select
                  className="bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-zinc-300 w-44 sm:w-52 focus:outline-none focus:border-emerald-500"
                  value={mapping[i] || ""}
                  onChange={(e) => setMap(i, (e.target.value || null) as FieldKey | null)}
                >
                  <option value="">Ignore this column</option>
                  {APP_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                      {f.required ? " *" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {result ? (
            <div className="p-6 text-center bg-zinc-950 rounded-xl border border-zinc-800">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-emerald-400">Import complete</h3>
              <p className="text-zinc-300 mt-2">
                <b>{result.created}</b> student{result.created === 1 ? "" : "s"} added
                {result.skipped > 0 && <> · <b>{result.skipped}</b> skipped</>}
              </p>
              {result.errors.length > 0 && (
                <div className="text-left max-h-48 overflow-y-auto rounded-md border border-amber-500/30 bg-amber-500/5 p-3 mt-4 space-y-1">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Skipped rows (row 1 = first student under the header)</p>
                  {result.errors.slice(0, 60).map((er, i) => (
                    <p key={i} className="text-xs text-zinc-300">
                      <span className="text-zinc-500">Row {er.row}:</span> {er.name} · {er.reason}
                    </p>
                  ))}
                  {result.errors.length > 60 && <p className="text-xs text-zinc-500">…and {result.errors.length - 60} more</p>}
                </div>
              )}
              <Button onClick={reset} variant="outline" className="mt-5">Import another file</Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="emerald">{valid.length} ready</Badge>
                {invalid.length > 0 && <Badge variant="outline" className="text-amber-400 border-amber-500/40">{invalid.length} need fixing (will be skipped)</Badge>}
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setStep(2)} disabled={importing}>Back</Button>
                <Button onClick={handleImport} disabled={importing || valid.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
                  {importing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing {progress}%</>
                  ) : (
                    `Import ${valid.length} student${valid.length === 1 ? "" : "s"}`
                  )}
                </Button>
              </div>

              {importing && (
                <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}

              {invalid.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 max-h-40 overflow-y-auto space-y-1">
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Fix these in your file and re-import, or continue without them</p>
                  {invalid.slice(0, 40).map((p) => (
                    <p key={p.fileRow} className="text-xs text-zinc-300">
                      <span className="text-zinc-500">Row {p.fileRow}:</span> {p.name} · {p.problems[0]}
                    </p>
                  ))}
                  {invalid.length > 40 && <p className="text-xs text-zinc-500">…and {invalid.length - 40} more</p>}
                </div>
              )}

              <div className="border border-zinc-800 rounded-lg overflow-x-auto bg-zinc-950">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900 text-zinc-400">
                    <tr>
                      {APP_FIELDS.filter((f) => mapping.includes(f.key)).map((f) => (
                        <th key={f.key} className="text-left font-medium px-3 py-2 whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {valid.slice(0, 5).map((p) => (
                      <tr key={p.fileRow} className="border-t border-zinc-800/60">
                        {APP_FIELDS.filter((f) => mapping.includes(f.key)).map((f) => (
                          <td key={f.key} className="px-3 py-2 text-zinc-300 whitespace-nowrap">{p.data[f.key] || "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {valid.length > 5 && <div className="p-2 text-center text-xs text-zinc-500 bg-zinc-900/30">Showing first 5 of {valid.length} ready rows</div>}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );

  if (embedded) return <div className="text-zinc-100">{body}</div>;
  return <Card className="p-6 bg-zinc-900/40 border-zinc-800 text-zinc-100 max-w-4xl mx-auto">{body}</Card>;
}
