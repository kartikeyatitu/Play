"use client";

import { ghostBtn } from "@/components/body/ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${ghostBtn} print:hidden`}>
      {label}
    </button>
  );
}
