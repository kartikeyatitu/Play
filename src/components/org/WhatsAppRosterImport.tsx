"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importStudents } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Sparkles, CheckCircle2, AlertCircle, X, Loader2, ArrowRight } from "lucide-react";

interface ParsedStudent {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  batchName: string;
  feeStatus: "PAID" | "PENDING";
  isValid: boolean;
  error?: string;
}

export function WhatsAppRosterImport({ existingBatches = [] }: { existingBatches?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedStudent[]>([]);
  const [selectedDefaultBatch, setSelectedDefaultBatch] = useState(existingBatches[0]?.name || "General Batch");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; name: string; reason: string }[] } | null>(null);

  // Smart parser for typical Indian sports academy WhatsApp roster messages
  function parseWhatsAppText(text: string) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const results: ParsedStudent[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip common WhatsApp headers like "Student List:", "Batch 1:", "Total: 25"
      if (/^(students?|batch|roster|total|fees?|timing|group|date):/i.test(line) && !line.includes("-") && !line.includes(",")) {
        continue;
      }

      // Try splitting by common delimiters: " - ", ",", "\t", " | ", "/"
      const parts = line.split(/\s*[-–|,/]\s*/).filter(Boolean);
      
      // Look for a 10-digit Indian phone number in the line
      const phoneMatch = line.match(/(?:\+?91[\s-]?)?([6-9]\d{9})/);
      const phone = phoneMatch ? phoneMatch[1] : "";

      let studentName = "";
      let parentName = "";
      let batchName = selectedDefaultBatch;
      let feeStatus: "PAID" | "PENDING" = "PENDING";

      if (/paid|done|received|clear|yes/i.test(line)) {
        feeStatus = "PAID";
      }

      if (parts.length >= 1) {
        // First part is usually the student name (clean off numbering like "1. ", "1)")
        studentName = parts[0].replace(/^\d+[\.\)\-\s]+/, "").trim();
      }

      // Check if any part matches a batch name or sport
      for (const part of parts) {
        if (/u-\d+|u\d+|cricket|football|tennis|badminton|swimming|morning|evening|weekend|elite|batch/i.test(part)) {
          batchName = part.trim();
        }
      }

      // If parent name is explicitly specified e.g. "Father: Rajesh" or "Parent: Priya"
      const parentMatch = line.match(/(?:father|mother|parent|guardian)[:\s]+([a-zA-Z\s]+)/i);
      if (parentMatch) {
        parentName = parentMatch[1].trim();
      } else if (studentName) {
        parentName = `Parent of ${studentName}`;
      }

      const isValid = Boolean(studentName.length >= 2 && phone.length === 10);
      let error = "";
      if (!studentName || studentName.length < 2) error = "Missing name";
      else if (phone.length !== 10) error = "Missing/invalid 10-digit phone";

      results.push({
        id: `row-${i}-${Date.now()}`,
        studentName,
        parentName,
        parentPhone: phone,
        batchName,
        feeStatus,
        isValid,
        error: error || undefined,
      });
    }

    setParsedRows(results);
  }

  function handleTextChange(val: string) {
    setRawText(val);
    if (val.trim()) {
      parseWhatsAppText(val);
    } else {
      setParsedRows([]);
    }
  }

  function updateRow(id: string, field: keyof ParsedStudent, val: any) {
    setParsedRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: val };
        const valid = Boolean(updated.studentName.length >= 2 && updated.parentPhone.replace(/[^0-9]/g, "").slice(-10).length === 10);
        return { ...updated, isValid: valid, error: valid ? undefined : "Check name & 10-digit phone" };
      })
    );
  }

  function removeRow(id: string) {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  }

  async function handleExecuteImport() {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsImporting(true);
    try {
      const payload = validRows.map(r => ({
        studentName: r.studentName,
        parentName: r.parentName,
        parentPhone: r.parentPhone,
        batchName: r.batchName,
        feeStatus: r.feeStatus,
      }));

      const res = await importStudents(payload);
      if (res.success) {
        setImportResult({ created: res.created ?? 0, skipped: res.skipped ?? 0, errors: res.errors ?? [] });
        router.refresh();
      } else {
        alert(res.error || "Failed to import students");
      }
    } catch (e: any) {
      alert(e?.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  const validCount = parsedRows.filter(r => r.isValid).length;

  return (
    <>
      <Button
        onClick={() => {
          setIsOpen(true);
          setImportResult(null);
        }}
        variant="outline"
        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs sm:text-sm font-medium gap-1.5"
      >
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span>⚡ Paste WhatsApp List</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in-0 zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-zinc-100">WhatsApp Roster Fast Import</h2>
                  <p className="text-xs text-zinc-400">Paste rough text from your WhatsApp group or notes — auto-detects names, numbers & batches</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {importResult ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-3xl">
                    🎉
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100">Import Successful!</h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Created <span className="text-emerald-400 font-semibold">{importResult.created} students & batches</span> ({importResult.skipped} skipped).
                    </p>
                    {importResult.errors.length > 0 && (
                      <div className="mt-3 max-w-md mx-auto text-left max-h-40 overflow-y-auto rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                        <p className="text-xs font-semibold text-amber-400">Skipped rows</p>
                        {importResult.errors.map((er, i) => (
                          <p key={i} className="text-xs text-zinc-300"><span className="text-zinc-500">#{er.row}</span> {er.name} — {er.reason}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 max-w-md mx-auto text-left text-xs text-zinc-300 space-y-2">
                    <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Ready on your dashboard
                    </p>
                    <p className="text-zinc-400">
                      Coaches can immediately mark attendance and send automated 1-tap WhatsApp login links or fee reminders from the People tab.
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center gap-3">
                    <Button
                      onClick={() => {
                        setImportResult(null);
                        setRawText("");
                        setParsedRows([]);
                        setIsOpen(false);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      Done & View Dashboard
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <label className="text-zinc-300 font-medium">Paste WhatsApp message, chat export, or phone notes:</label>
                      <button
                        type="button"
                        onClick={() => {
                          const sample = `1. Aarav Patel - 9812345678 - U14 Cricket - Paid\n2. Vivaan Singh - 9876543210 - U14 Cricket - Due\n3. Rohan Sharma, 9998887776, Football Morning\n4. Ananya Verma - 9822334455 - Tennis Elite - Paid`;
                          handleTextChange(sample);
                        }}
                        className="text-emerald-400 hover:underline text-[11px]"
                      >
                        Load sample format
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={rawText}
                      onChange={e => handleTextChange(e.target.value)}
                      placeholder={`Example:\nAarav Patel - 9812345678 - U14 Cricket - Paid\nVivaan Singh - 9876543210 - Football - Due\nRohan Mehra, 9998887776, Tennis`}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs sm:text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {parsedRows.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-200">Parsed Preview ({parsedRows.length} rows)</span>
                          <Badge variant="outline" className={validCount === parsedRows.length ? "text-emerald-400 border-emerald-500/40" : "text-amber-400 border-amber-500/40"}>
                            {validCount} ready to import
                          </Badge>
                        </div>
                        <span className="text-[11px] text-zinc-500">Edit fields directly in table if needed</span>
                      </div>

                      <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 max-h-60 overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-zinc-900 sticky top-0 text-[11px]">
                            <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                              <TableHead className="text-zinc-400 py-2">Student Name</TableHead>
                              <TableHead className="text-zinc-400 py-2">Parent Mobile</TableHead>
                              <TableHead className="text-zinc-400 py-2">Batch</TableHead>
                              <TableHead className="text-zinc-400 py-2">Fee Status</TableHead>
                              <TableHead className="text-zinc-400 py-2 w-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="text-xs">
                            {parsedRows.map(row => (
                              <TableRow key={row.id} className="border-b border-zinc-850 hover:bg-zinc-900/50">
                                <TableCell className="py-1.5 font-medium">
                                  <input
                                    type="text"
                                    value={row.studentName}
                                    onChange={e => updateRow(row.id, "studentName", e.target.value)}
                                    className="bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 focus:outline-none w-full text-zinc-200 text-xs"
                                  />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <input
                                    type="text"
                                    value={row.parentPhone}
                                    onChange={e => updateRow(row.id, "parentPhone", e.target.value)}
                                    className={`bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 focus:outline-none w-28 font-mono text-xs ${
                                      row.parentPhone.length === 10 ? "text-zinc-300" : "text-rose-400 font-bold"
                                    }`}
                                    placeholder="10 digits"
                                  />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <input
                                    type="text"
                                    value={row.batchName}
                                    onChange={e => updateRow(row.id, "batchName", e.target.value)}
                                    className="bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 focus:outline-none w-full text-zinc-300 text-xs"
                                  />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <select
                                    value={row.feeStatus}
                                    onChange={e => updateRow(row.id, "feeStatus", e.target.value as any)}
                                    className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-zinc-300 focus:outline-none"
                                  >
                                    <option value="PAID">Paid</option>
                                    <option value="PENDING">Due</option>
                                  </select>
                                </TableCell>
                                <TableCell className="py-1.5 text-right">
                                  <button
                                    onClick={() => removeRow(row.id)}
                                    className="text-zinc-500 hover:text-rose-400 transition"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Actions */}
            {!importResult && (
              <div className="p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-950">
                <span className="text-xs text-zinc-500">
                  {validCount > 0 ? `Ready to create ${validCount} students` : "Paste roster to start"}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={isImporting}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExecuteImport}
                    disabled={isImporting || validCount === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1.5"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <span>Import {validCount} Students</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
