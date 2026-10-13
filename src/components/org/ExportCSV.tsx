"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportAllStudentsCSV } from "@/app/actions/export";

type StudentData = {
  name: string;
  parentName: string;
  parentPhone: string;
  batchNames: string;
  feeStatus: string;
};

export function ExportCSV({
  students,
  label = "Export Full Roster (Excel / CSV)",
}: {
  students?: StudentData[];
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    const toastId = toast.loading("Generating full roster CSV with Excel UTF-8 encoding...");

    try {
      // 1. Try server-side full export first (fetches all students, no 20 limit)
      const res = await exportAllStudentsCSV();

      if (res.success && res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.filename || "triq_students.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${res.count || "all"} students successfully!`, { id: toastId });
        return;
      }

      // 2. Client-side fallback if server action returns an error or empty
      if (students && students.length > 0) {
        const headers = ["Name", "Parent Name", "Parent Phone", "Batches", "Fee Status"];
        const rows = students.map((s) => [
          `"${(s.name || "").replace(/"/g, '""')}"`,
          `"${(s.parentName || "").replace(/"/g, '""')}"`,
          `"${(s.parentPhone || "").replace(/"/g, '""')}"`,
          `"${(s.batchNames || "").replace(/"/g, '""')}"`,
          `"${(s.feeStatus || "").replace(/"/g, '""')}"`,
        ].join(","));

        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "students_export.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${students.length} students.`, { id: toastId });
        return;
      }

      toast.error(res.error || "No students available to export.", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Failed to download export.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      variant="outline"
      className="border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 hover:text-white font-medium text-xs sm:text-sm h-10 px-4 transition-all"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin text-lime-400" />
      ) : (
        <Download className="w-4 h-4 mr-2 text-lime-400" />
      )}
      {label}
    </Button>
  );
}
