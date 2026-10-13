"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface DataFiltersProps {
  filters: FilterOption[];
  onFilterChange: (active: Record<string, string>) => void;
}

export function DataFilters({ filters, onFilterChange }: DataFiltersProps) {
  const [active, setActive] = useState<Record<string, string>>({});

  const toggle = (key: string, value: string) => {
    const next = { ...active };
    if (next[key] === value) delete next[key];
    else next[key] = value;
    setActive(next);
    onFilterChange(next);
  };

  const clearAll = () => {
    setActive({});
    onFilterChange({});
  };

  const hasFilters = Object.keys(active).length > 0;

  return (
    <div className="space-y-2">
      {filters.map(filter => (
        <div key={filter.key} className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 w-20">{filter.label}:</span>
          {filter.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggle(filter.key, opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                active[filter.key] === opt.value
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-800/50"
                  : "bg-zinc-800/50 text-zinc-400 border border-zinc-800 hover:bg-zinc-700/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ))}
      {hasFilters && (
        <button onClick={clearAll} className="text-xs text-zinc-600 hover:text-zinc-400 underline">
          Clear all filters
        </button>
      )}
    </div>
  );
}
