"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusChipVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-heading font-bold uppercase tracking-wider select-none border transition-colors",
  {
    variants: {
      status: {
        paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        due: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        overdue: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        confirmed: "bg-lime-400/10 text-lime-400 border-lime-400/30",
        hold: "bg-amber-400/10 text-amber-300 border-amber-400/30",
        cancelled: "bg-zinc-800 text-zinc-400 border-zinc-700",
        present: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
        absent: "bg-zinc-800/80 text-zinc-500 border-zinc-700/60",
        active: "bg-lime-500/10 text-lime-400 border-lime-500/30",
        inactive: "bg-zinc-800 text-zinc-500 border-zinc-700",
      },
    },
    defaultVariants: {
      status: "active",
    },
  }
);

export interface StatusChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusChipVariants> {
  label?: string;
}

export function StatusChip({ status, label, className, children, ...props }: StatusChipProps) {
  const displayLabel = label || children || status;
  return (
    <span className={cn(statusChipVariants({ status, className }))} {...props}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {displayLabel}
    </span>
  );
}
