"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { matchCities, type CitySuggestion } from "@/lib/cities";
import { searchCities, type PlaceSuggestion } from "@/app/actions/places";
import { MapPin, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string, country?: string) => void;
  /** ISO 3166-1 alpha-2. If set, static suggestions are filtered to this country. */
  country?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
}

/** Internal shape — either source (static or Google Places) rendered the same way. */
interface Suggestion {
  key: string;
  name: string;
  subtitle: string;
  country?: string;
  source: "static" | "places";
}

const toStatic = (s: CitySuggestion): Suggestion => ({
  key: `s:${s.name}-${s.country}`,
  name: s.name,
  subtitle: s.country,
  country: s.country,
  source: "static",
});

const toPlaces = (p: PlaceSuggestion): Suggestion => ({
  key: `p:${p.placeId}`,
  name: p.mainText,
  subtitle: p.secondaryText,
  country: p.country,
  source: "places",
});

/**
 * City input with live autocomplete.
 *
 * Two sources in order of preference:
 * 1. Static curated list — rendered instantly on every keystroke (zero latency).
 * 2. Google Places (via server action) — fetched on debounce; replaces static
 *    when results arrive. If Places fails or returns empty, static stays.
 *
 * Free-text is always accepted — the user can type any city not in either list.
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Guard against stale server responses overwriting newer ones.
  const requestIdRef = useRef(0);

  // Instant static matches on every value/country change.
  useEffect(() => {
    const matches = matchCities(value, country, 8).map(toStatic);
    setSuggestions(matches);
    setActiveIndex(0);
  }, [value, country]);

  // Debounced Google Places call — kicks in once the user has typed ≥ 2 chars.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return;

    const myRequest = ++requestIdRef.current;
    setLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const results = await searchCities(q);
        // Discard if a newer keystroke already fired another request.
        if (myRequest !== requestIdRef.current) return;
        if (results.length > 0) {
          setSuggestions(results.map(toPlaces));
          setActiveIndex(0);
        }
      } catch {
        // Keep static fallback on error.
      } finally {
        if (myRequest === requestIdRef.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [value]);

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

  const pick = (s: Suggestion) => {
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

  const isExactMatch = suggestions.some(
    (s) => s.name.toLowerCase() === value.trim().toLowerCase(),
  );

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
      {loading && (
        <Loader2
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin"
          aria-hidden
        />
      )}
      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
        >
          {suggestions.map((s, i) => {
            const active = i === activeIndex;
            const selected =
              isExactMatch && s.name.toLowerCase() === value.trim().toLowerCase();
            return (
              <button
                key={s.key}
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
                  {s.subtitle && (
                    <span className="text-[11px] text-zinc-500 truncate shrink-0">
                      {s.subtitle}
                    </span>
                  )}
                </span>
                {selected && <Check className="w-4 h-4 text-lime-400 shrink-0" aria-hidden />}
              </button>
            );
          })}
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
