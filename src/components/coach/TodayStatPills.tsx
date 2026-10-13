/** Inline summary pills for the coach Today tab: "2 sessions · 21/26 in · 3 to watch". */
export function TodayStatPills({
  sessions,
  inToday,
  total,
  toWatch,
}: {
  sessions: number;
  inToday: number;
  total: number;
  toWatch: number;
}) {
  const pill = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm whitespace-nowrap";
  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0" aria-label="Today at a glance">
      <span className={`${pill} border-zinc-800 bg-zinc-900/50 text-zinc-200`}>
        <span className="font-bold text-white tabular-nums">{sessions}</span>
        {sessions === 1 ? "session" : "sessions"}
      </span>
      <span className={`${pill} border-zinc-800 bg-zinc-900/50 text-zinc-400`}>
        <span className="tabular-nums">
          <span className="font-bold text-white">{inToday}</span>/{total}
        </span>
        in
      </span>
      {toWatch > 0 && (
        <span className={`${pill} border-amber-500/30 bg-amber-500/10 text-amber-300`}>
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" aria-hidden />
          <span className="font-bold tabular-nums">{toWatch}</span> to watch
        </span>
      )}
    </div>
  );
}
