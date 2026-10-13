// Instant skeleton shown while the coach page streams in (perceived speed on slow 4G).
export default function CoachLoading() {
  return (
    <div className="min-h-screen bg-zinc-950" aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 h-14 border-b border-zinc-900 bg-zinc-950/90" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 space-y-5 animate-pulse">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-zinc-900" />
          <div className="h-8 w-56 rounded-lg bg-zinc-900" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-full bg-zinc-900" />
          <div className="h-8 w-20 rounded-full bg-zinc-900" />
          <div className="h-8 w-24 rounded-full bg-zinc-900" />
        </div>
        <div className="h-64 rounded-3xl bg-zinc-900/70" />
        <div className="h-24 rounded-3xl bg-zinc-900/50" />
      </main>
      <div className="fixed bottom-0 inset-x-0 h-16 border-t border-zinc-900 bg-zinc-950" />
    </div>
  );
}
