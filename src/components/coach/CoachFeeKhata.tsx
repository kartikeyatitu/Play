"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndianRupee, MessageCircle, CheckCircle2, AlertCircle, Search, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export interface CoachStudentFee {
  studentId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  batchName: string;
  monthlyFee: number;
  feeStatus: "PAID" | "PENDING";
  month: string;
}

export function CoachFeeKhata({
  coachName,
  academyName,
  upiId,
  students = [],
  currentMonth,
}: {
  coachName: string;
  academyName: string;
  upiId?: string | null;
  students: CoachStudentFee[];
  currentMonth: string;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "DUE" | "PAID">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Compute metrics
  const totalStudents = students.length;
  const paidStudents = students.filter(s => s.feeStatus === "PAID");
  const dueStudents = students.filter(s => s.feeStatus === "PENDING");
  
  const totalBilled = students.reduce((sum, s) => sum + s.monthlyFee, 0);
  const totalCollected = paidStudents.reduce((sum, s) => sum + s.monthlyFee, 0);
  const totalDue = dueStudents.reduce((sum, s) => sum + s.monthlyFee, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Filtered list
  const filtered = students.filter(s => {
    if (filter === "DUE" && s.feeStatus !== "PENDING") return false;
    if (filter === "PAID" && s.feeStatus !== "PAID") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.studentName.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q) ||
        s.batchName.toLowerCase().includes(q) ||
        s.parentPhone.includes(q)
      );
    }
    return true;
  });

  function getWhatsAppReminderUrl(student: CoachStudentFee) {
    const cleanPhone = student.parentPhone.replace(/[^0-9]/g, "").slice(-10);
    if (cleanPhone.length !== 10) return null;
    const amountStr = student.monthlyFee > 0 ? `₹${student.monthlyFee.toLocaleString("en-IN")}` : "monthly fee";
    
    let upiText = "";
    if (upiId) {
      upiText = `\n\nDirect UPI ID: ${upiId}\nUPI Pay Link: upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(academyName)}&am=${student.monthlyFee}&cu=INR`;
    }

    const message = `Hi ${student.parentName}, this is Coach ${coachName} from ${academyName}.\n\nFriendly reminder that ${student.studentName}'s sports coaching fee of ${amountStr} for ${currentMonth} is currently due.${upiText}\n\nKindly confirm once paid. Thank you!`;

    return `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  function handleCopyReminder(student: CoachStudentFee) {
    const url = getWhatsAppReminderUrl(student);
    if (!url) return;
    const textMatch = url.match(/text=(.*)/);
    if (textMatch) {
      navigator.clipboard.writeText(decodeURIComponent(textMatch[1]));
      setCopiedId(student.studentId);
      toast.success("Reminder text copied to clipboard");
      setTimeout(() => setCopiedId(null), 2500);
    }
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800/80 overflow-hidden">
      <CardHeader className="p-4 sm:p-6 border-b border-zinc-850">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                ₹
              </div>
              <CardTitle className="text-lg font-semibold text-zinc-100">Coach Fee Khata</CardTitle>
              <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-[10px]">
                {currentMonth}
              </Badge>
            </div>
            <CardDescription className="text-xs text-zinc-400 mt-1">
              Track student dues for your batches & send 1-tap WhatsApp fee reminders
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              Collection: <span className="font-semibold text-emerald-400">{collectionRate}%</span>
            </span>
            <div className="w-24 bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mt-4 pt-4 border-t border-zinc-800/50">
          <div className="bg-zinc-950/60 p-2.5 sm:p-3 rounded-lg border border-zinc-800/60">
            <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Collected</div>
            <div className="text-sm sm:text-xl font-bold text-emerald-400 mt-0.5">
              ₹{totalCollected.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">{paidStudents.length} paid</div>
          </div>

          <div className="bg-zinc-950/60 p-2.5 sm:p-3 rounded-lg border border-zinc-800/60">
            <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Pending Dues</div>
            <div className="text-sm sm:text-xl font-bold text-amber-400 mt-0.5">
              ₹{totalDue.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">{dueStudents.length} unpaid</div>
          </div>

          <div className="bg-zinc-950/60 p-2.5 sm:p-3 rounded-lg border border-zinc-800/60">
            <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Total Billed</div>
            <div className="text-sm sm:text-xl font-bold text-zinc-200 mt-0.5">
              ₹{totalBilled.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">{totalStudents} students</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student, parent, batch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-xs rounded-lg pl-8 pr-3 py-1.5 w-full text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-1.5 self-start">
            <Button
              variant={filter === "ALL" ? "default" : "outline"}
              onClick={() => setFilter("ALL")}
              className={`text-xs h-7 px-2.5 ${filter === "ALL" ? "bg-zinc-800 text-white" : "border-zinc-800 text-zinc-400"}`}
            >
              All ({totalStudents})
            </Button>
            <Button
              variant={filter === "DUE" ? "default" : "outline"}
              onClick={() => setFilter("DUE")}
              className={`text-xs h-7 px-2.5 ${filter === "DUE" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "border-zinc-800 text-zinc-400"}`}
            >
              Due ({dueStudents.length})
            </Button>
            <Button
              variant={filter === "PAID" ? "default" : "outline"}
              onClick={() => setFilter("PAID")}
              className={`text-xs h-7 px-2.5 ${filter === "PAID" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "border-zinc-800 text-zinc-400"}`}
            >
              Paid ({paidStudents.length})
            </Button>
          </div>
        </div>

        {/* Students Table */}
        <div className="rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950/60">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-900/60 text-[11px]">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 py-2.5">Student</TableHead>
                  <TableHead className="text-zinc-400 py-2.5">Parent / Contact</TableHead>
                  <TableHead className="text-zinc-400 py-2.5">Batch</TableHead>
                  <TableHead className="text-zinc-400 py-2.5 text-right">Fee</TableHead>
                  <TableHead className="text-zinc-400 py-2.5 text-center">Status</TableHead>
                  <TableHead className="text-zinc-400 py-2.5 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs divide-y divide-zinc-800/60">
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                      No students found matching your filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(s => {
                    const isDue = s.feeStatus === "PENDING";
                    return (
                      <TableRow key={`${s.studentId}-${s.batchName}`} className="hover:bg-zinc-900/40">
                        <TableCell className="font-medium text-zinc-200 py-2.5">
                          {s.studentName}
                        </TableCell>
                        <TableCell className="text-zinc-400 py-2.5">
                          <div>{s.parentName}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{s.parentPhone}</div>
                        </TableCell>
                        <TableCell className="text-zinc-400 py-2.5">
                          <span className="truncate max-w-[120px] block">{s.batchName}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-zinc-200 py-2.5">
                          ₹{s.monthlyFee.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          {isDue ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] px-2 py-0.5">
                              Due
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5">
                              Paid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                          {isDue ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {getWhatsAppReminderUrl(s) ? (
                              <a
                                href={getWhatsAppReminderUrl(s) as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1 rounded text-[11px] transition shadow-sm"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Remind</span>
                              </a>
                              ) : (
                                <span className="text-[10px] text-zinc-500">No phone</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyReminder(s)}
                                title="Copy reminder text"
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                              >
                                {copiedId === s.studentId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Clear</span>
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
