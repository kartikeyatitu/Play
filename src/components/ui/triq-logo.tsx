/** Triq mark: a forward-leaning T on the accent square. Pure SVG, no image request. */
export function TriqMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} aria-hidden focusable="false">
      <rect width="28" height="28" rx="7" fill="rgb(var(--c-accent))" />
      <path d="M8 7h14l-.8 3.5h-4.1L14.7 21h-3.5l2.4-10.5H7.2z" fill="rgb(var(--c-accent-fg))" />
    </svg>
  );
}

/** Mark + "Triq" wordmark set in Geist. */
export function TriqWordmark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <TriqMark size={size} />
      <span className="font-semibold tracking-[-0.03em] text-ink" style={{ fontSize: Math.round(size * 0.68) }}>
        Triq
      </span>
    </span>
  );
}
