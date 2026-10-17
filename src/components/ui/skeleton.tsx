"use client";

/** Shimmer placeholder (.skeleton in globals.css; static under reduced motion). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-surface/30 border border-line/50 rounded-xl p-5 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

/**
 * Screen-level loading state shared by Today, Team and Payroll: a title, a row of tiles and
 * a few list cards, so content lands where the placeholders were (no layout jump).
 */
export function PanelSkeleton({ label, tiles = 3, rows = 4 }: { label: string; tiles?: number; rows?: number }) {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <div className={`grid gap-2 sm:gap-3 ${tiles === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="rounded-xl border border-line/70 bg-surface/40 p-3 sm:p-4 space-y-2.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface/40 p-3 sm:p-4">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 pb-2 border-b border-line">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
