"use client";
// Batch leaderboard: per age group, first name + last initial, XP and streak only (never points, photos
// or wellbeing). Only opted-in children appear.

import { useEffect, useState, useTransition } from "react";
import { Flame } from "lucide-react";
import { getLeaderboard } from "@/app/actions/rewards";
import { Panel } from "./ui";

type Result = Awaited<ReturnType<typeof getLeaderboard>>;

export function LeaderboardView({ batches }: { batches: { id: string; name: string }[] }) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [data, setData] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!batchId) return;
    start(async () => setData(await getLeaderboard(batchId)));
  }, [batchId]);

  if (!batches.length) return <p className="text-sm text-ink-muted">Not in a batch yet.</p>;

  return (
    <Panel
      title="Leaderboard"
      action={
        batches.length > 1 ? (
          <select
            aria-label="Batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="min-h-[44px] rounded-xl border border-line bg-canvas px-3 text-sm text-ink"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {pending && !data ? <p className="text-sm text-ink-muted">Loading…</p> : null}
      {data && !data.ok ? <p className="text-sm text-danger">{data.error}</p> : null}
      {data && data.ok && data.groups.length === 0 ? (
        <p className="text-sm text-ink-muted">No one in this age group has joined the leaderboard yet.</p>
      ) : null}
      {data && data.ok
        ? data.groups.map((g) => (
            <div key={g.ageGroup} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{g.ageGroup}</h3>
              <ol className="divide-y divide-line">
                {g.rows.map((r, i) => (
                  <li key={i} className={`flex min-h-[44px] items-center gap-3 py-2 text-sm ${r.mine ? "font-semibold text-ink" : "text-ink-muted"}`}>
                    <span className="w-6 text-right tabular-nums text-ink-subtle">{r.rank}</span>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums" title="Sessions in a row">
                      <Flame className="h-3.5 w-3.5" aria-hidden />
                      {r.streak}
                    </span>
                    <span className="w-16 text-right tabular-nums">{r.xp} XP</span>
                  </li>
                ))}
              </ol>
            </div>
          ))
        : null}
      <p className="mt-3 text-xs text-ink-subtle">Shows XP and attendance streaks only, never points. First names and last initials only.</p>
    </Panel>
  );
}
