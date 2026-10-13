"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shellButton } from "@/components/shell/EmptyState";
import { ExcelImport } from "@/components/org/ExcelImport";

/** "Import Excel/CSV" button for the Students screen: opens the importer in a dialog. */
export function ImportExcelButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button type="button" className={shellButton.quiet} onClick={() => setOpen(true)}>
        <FileSpreadsheet className="w-4 h-4" /> Import Excel/CSV
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import students from Excel / CSV</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70vh] pr-1">
            <ExcelImport embedded onDone={() => router.refresh()} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
