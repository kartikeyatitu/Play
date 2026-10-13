"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Range = "7d" | "30d" | "90d" | "all";

interface DateRangePickerProps {
  onChange: (range: Range, startDate: Date | null) => void;
}

export function DateRangePicker({ onChange }: DateRangePickerProps) {
  const [active, setActive] = useState<Range>("30d");

  const ranges: { key: Range; label: string; days: number | null }[] = [
    { key: "7d", label: "This Week", days: 7 },
    { key: "30d", label: "This Month", days: 30 },
    { key: "90d", label: "This Quarter", days: 90 },
    { key: "all", label: "All Time", days: null },
  ];

  const handleClick = (range: Range, days: number | null) => {
    setActive(range);
    const startDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
    onChange(range, startDate);
  };

  return (
    <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-1">
      {ranges.map(r => (
        <button
          key={r.key}
          onClick={() => handleClick(r.key, r.days)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            active === r.key
              ? "bg-emerald-500/20 text-emerald-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
