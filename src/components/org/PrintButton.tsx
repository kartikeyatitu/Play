"use client";

import { Printer } from "lucide-react";

/** Opens the browser print dialog (print / save as PDF). Hidden when printing. */
export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
    >
      <Printer className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
}
