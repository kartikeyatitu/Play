"use client";

import { Printer, MessageCircle } from "lucide-react";

/** Print + WhatsApp share buttons for the monthly progress report (deep link only; nothing is sent server-side). */
export function ReportActions({ whatsappHref, toParent }: { whatsappHref: string; toParent: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
      >
        <Printer className="h-4 w-4" aria-hidden /> Print / save as PDF
      </button>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        <MessageCircle className="h-4 w-4" aria-hidden /> {toParent ? "Send to parent on WhatsApp" : "Share on WhatsApp"}
      </a>
    </div>
  );
}
