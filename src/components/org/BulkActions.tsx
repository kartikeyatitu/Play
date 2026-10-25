"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentMethodBadge } from "@/components/ui/payment-method-badge";
import { markFeeAsPaid } from "@/app/actions/fees";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BulkActionsProps {
  students: { id: string; name: string; feeRecords: { id: string; status: string; month: string; paymentMethod?: string | null }[] }[];
  currentMonth: string;
}

export function BulkActions({ students, currentMonth }: BulkActionsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === students.length) setSelected(new Set());
    else setSelected(new Set(students.map(s => s.id)));
  };

  const bulkMarkPaid = async () => {
    setLoading(true);
    let count = 0;
    for (const studentId of selected) {
      const student = students.find(s => s.id === studentId);
      const fee = student?.feeRecords.find(f => f.month === currentMonth);
      if (fee && fee.status !== "PAID") {
        // Fix pre-existing bug: old call passed (fee.id, "PAID") but
        // the action expects (studentId, month). The result was silently
        // rejected ("Invalid month."); the bulk mark-paid did nothing.
        const res = await markFeeAsPaid(studentId, currentMonth);
        if (res.success) count++;
      }
    }
    toast.success(`Marked ${count} students as PAID`);
    setSelected(new Set());
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={selectAll} className="border-zinc-700 text-zinc-400 h-8">
          {selected.size === students.length ? "Deselect All" : "Select All"}
        </Button>
        {selected.size > 0 && (
          <>
            <Badge variant="sky">{selected.size} selected</Badge>
            <Button size="sm" onClick={bulkMarkPaid} disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8">
              {loading ? "Processing..." : `Mark ${selected.size} as PAID`}
            </Button>
          </>
        )}
      </div>
      <div className="space-y-1">
        {students.map(s => {
          const fee = s.feeRecords.find(f => f.month === currentMonth);
          return (
            <div key={s.id}
              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                selected.has(s.id) ? "bg-emerald-500/10 border border-emerald-800/30" : "hover:bg-zinc-800/50"
              }`}
              onClick={() => toggleSelect(s.id)}
            >
              <input type="checkbox" checked={selected.has(s.id)} readOnly className="accent-emerald-500" />
              <span className="text-sm text-white flex-1">{s.name}</span>
              <PaymentMethodBadge status={fee?.status} method={fee?.paymentMethod} />
              <Badge variant={fee?.status === "PAID" ? "lime" : "rose"}>
                {fee?.status || "NO FEE"}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
