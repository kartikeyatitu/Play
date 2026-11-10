"use client";
// Venue map: a light placeholder until tapped, then Google Maps (no key needed). Loading on tap keeps
// pages fast on slow networks and means Google isn't contacted unless the person wants the map.
import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";

export const directionsUrl = (place: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;

export function VenueMap({ place, label, className = "" }: { place: string; label?: string; className?: string }) {
  const [show, setShow] = useState(false);
  const q = place.trim();
  if (!q) return null;
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
      {show ? (
        <iframe
          title={`Map of ${label || q}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`}
          className="block h-56 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="relative flex h-40 w-full items-center justify-center overflow-hidden text-left"
          aria-label={`Show map of ${label || q}`}
          style={{
            background:
              "radial-gradient(circle at 30% 40%, color-mix(in srgb, var(--brand) 18%, transparent), transparent 60%), repeating-linear-gradient(45deg, color-mix(in srgb, var(--ink, #888) 6%, transparent) 0 2px, transparent 2px 14px)",
          }}
        >
          <span className="flex flex-col items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full brand-bg shadow-lg">
              <MapPin className="h-5 w-5" aria-hidden />
            </span>
            <span className="rounded-full bg-surface/90 px-3 py-1 text-sm font-semibold text-ink shadow">Show map</span>
          </span>
        </button>
      )}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 text-sm text-ink">
          {label && <span className="block font-semibold">{label}</span>}
          <span className="block truncate text-ink-muted">{q}</span>
        </p>
        <a
          href={directionsUrl(q)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full brand-bg px-4 text-sm font-semibold"
        >
          <Navigation className="h-4 w-4" aria-hidden /> Directions
        </a>
      </div>
    </div>
  );
}
