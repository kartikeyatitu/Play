"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { matchCities, type CitySuggestion } from "@/lib/cities";
import { MapPin, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string, country?: string) => void;
  /** ISO 3166-1 alpha-2. If set, suggestions are filtered to this country. */
  country?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
}

/**
 * Searchable city input: typeahead suggestions from a curated list +
 * free-text fallback for any city not on the list. Picking a suggestion
 * also communicates its country, so the parent can auto-set country.
 */
export function CityAutocomplete({
  value,
  onChange,
  country,
  id = "city-autocomplete",
  placeholder = "Start typing your city…",
  required,
  maxLength = 60,
  className,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Recompute suggestions on value or country change.
  useEffect(() => {
    setSuggestions(matchCities(value, country, 8));
    setActiveIndex(0);
  }, [value, country]);

  // Close on outside click.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (s: CitySuggestion) => {
    onChange(s.name, s.country);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Does the current typed value already match one of our suggestions exactly?
  const isExactMatch = suggestions.some((s) => s.name.toLowerCase() === value.trim().toLowerCase());

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        className={cn("h-12 text-base", className)}
      />
      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
        >
          {suggestions.map((s, i) => {
            const active = i === activeIndex;
            const selected = isExactMatch && s.name.toLowerCase() === value.trim().toLowerCase();
            return (
              <button
                key={`${s.name}-${s.country}`}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => e.preventDefault() /* keep focus on input */}
                onClick={() => pick(s)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                  active ? "bg-lime-400/10 text-lime-200" : "text-zinc-200 hover:bg-zinc-900",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" aria-hidden />
                  <span className="truncate">{s.name}</span>
                  <span className="text-[11px] text-zinc-500 uppercase shrink-0">{s.country}</span>
                </span>
                {selected && <Check className="w-4 h-4 text-lime-400" aria-hidden />}
              </button>
            );
          })}
          {/* Free-text hint when user is typing something not on the list */}
          {value.trim().length >= 2 && !isExactMatch && (
            <div className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500 bg-zinc-900/60">
              Can&apos;t find yours? Just keep typing — any city works.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
