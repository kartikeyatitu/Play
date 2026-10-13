// Instant skeleton shown while the academy dashboard streams in (mirrors the Today screen layout).
export default function OrgLoading() {
  return (
    <div className="min-h-screen bg-zinc-950" aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 h-14 border-b border-zinc-800/60 bg-zinc-950/90" />
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-zinc-900" />
          <div className="h-8 w-56 rounded-lg bg-zinc-900" />
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[84px] rounded-xl border border-zinc-800/60 bg-zinc-900/50" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[52px] rounded-xl border border-zinc-800/60 bg-zinc-900/40" />
          ))}
        </div>
      </main>
      <div className="fixed bottom-0 inset-x-0 h-14 border-t border-zinc-800/80 bg-zinc-950 lg:hidden" />
    </div>
  );
}
