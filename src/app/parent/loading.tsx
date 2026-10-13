// Instant skeleton shown while the parent dashboard streams in.
export default function ParentLoading() {
  return (
    <div className="min-h-screen bg-zinc-950" aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 h-14 border-b border-zinc-900 bg-zinc-950/90" />
      <main className="max-w-3xl mx-auto px-4 pt-5 space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-zinc-900" />
        <div className="h-40 rounded-3xl bg-zinc-900/70" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-zinc-900/60" />
          <div className="h-24 rounded-2xl bg-zinc-900/60" />
        </div>
        <div className="h-32 rounded-3xl bg-zinc-900/50" />
      </main>
    </div>
  );
}
