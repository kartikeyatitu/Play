"use client";
// Parent rewards screen (spec §7): child card, rewards catalogue, history, settings. Phone-first.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Gift } from "lucide-react";
import { cancelRedemption, requestRedemption, setLeaderboardOptIn, type getChildRewards } from "@/app/actions/rewards";
import { BadgeIcon, fmtDate, GhostButton, Panel, PrimaryButton, sportName, StatusText, Tabs, XpBar } from "./ui";
import { LeaderboardView } from "./LeaderboardView";

export type ChildRewards = Extract<Awaited<ReturnType<typeof getChildRewards>>, { ok: true }>;
type Tab = "card" | "rewards" | "history" | "settings";

export function ChildRewardsView({ data }: { data: ChildRewards }) {
  const [tab, setTab] = useState<Tab>("card");
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong");
      else {
        toast.success(done);
        router.refresh();
      }
    });

  const openRequests = data.redemptions.filter((r) => r.status === "REQUESTED" || r.status === "APPROVED");

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">Points to spend</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-ink">{data.points.balance}</p>
        {data.points.expiringSoon > 0 ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-warn">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {data.points.expiringSoon} points expire on {fmtDate(data.points.expiringFirstAt)}. Points last 12 months from when they're earned.
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink-subtle">Points last 12 months from when they're earned. XP never expires.</p>
        )}
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "card", label: "Progress" },
          { key: "rewards", label: "Rewards", count: openRequests.length || undefined },
          { key: "history", label: "History" },
          { key: "settings", label: "Settings" },
        ]}
      />

      {tab === "card" && (
        <div className="space-y-4">
          <Panel title="Level per sport">
            {data.levels.length === 0 ? (
              <p className="text-sm text-ink-muted">XP starts with the first session. Every session, match and drill counts.</p>
            ) : (
              <ul className="space-y-4">
                {data.levels.map((l) => (
                  <li key={l.sport}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{sportName(l.sport)}</span>
                      <span className="text-sm text-ink-muted">
                        Level {l.level} · {l.tier}
                      </span>
                    </div>
                    <XpBar progress={l.progress} label={`${sportName(l.sport)} XP progress`} />
                    <p className="mt-1 text-xs text-ink-subtle tabular-nums">
                      {l.xp} XP{l.nextAt != null ? ` · ${l.nextAt - l.xp} to Level ${l.level + 1}` : " · top level"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={`Badges (${data.badges.length})`}>
            {data.badges.length === 0 ? (
              <p className="text-sm text-ink-muted">The first badge comes with the first session.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.badges.map((b) => (
                  <li key={b.key} className="rounded-xl border border-line bg-canvas p-3">
                    <div className="flex items-center gap-2 text-volt-ink">
                      <BadgeIcon icon={b.icon} />
                      <span className="text-sm font-semibold text-ink">{b.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{b.reason || b.description}</p>
                    <p className="mt-1 text-[11px] text-ink-subtle">{fmtDate(b.awardedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {data.leaderboardOptIn ? <LeaderboardView batches={data.student.batches} /> : null}
        </div>
      )}

      {tab === "rewards" && (
        <div className="space-y-4">
          {openRequests.length > 0 && (
            <Panel title="Your requests">
              <ul className="divide-y divide-line">
                {openRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{r.item}</p>
                      <p className="text-xs text-ink-subtle">
                        {r.costPoints} points · <StatusText status={r.status} />
                      </p>
                    </div>
                    {r.status === "REQUESTED" ? (
                      <GhostButton tone="danger" disabled={pending} onClick={() => run(() => cancelRedemption(r.id), "Request cancelled, points returned")}>
                        Cancel
                      </GhostButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Rewards">
            {data.catalogue.length === 0 ? (
              <p className="text-sm text-ink-muted">Your academy hasn't added rewards yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.catalogue.map((it) => (
                  <li key={it.id} className="rounded-xl border border-line bg-canvas p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{it.name}</p>
                        {it.description ? <p className="text-sm text-ink-muted">{it.description}</p> : null}
                        <p className="mt-1 text-sm tabular-nums text-ink">{it.costPoints} points</p>
                      </div>
                      <Gift className="h-5 w-5 shrink-0 text-volt-ink" aria-hidden />
                    </div>
                    {it.problems.length ? (
                      <ul className="mt-2 space-y-0.5">
                        {it.problems.map((p) => (
                          <li key={p} className="text-xs text-ink-subtle">
                            {p}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-3">
                        <PrimaryButton disabled={pending} onClick={() => run(() => requestRedemption(data.student.id, it.id), "Requested. The academy will confirm.")}>
                          Request for {it.costPoints} points
                        </PrimaryButton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-subtle">Points are held when you request. If the academy declines or you cancel, they come back.</p>
          </Panel>
        </div>
      )}

      {tab === "history" && (
        <Panel title="Every earn and spend">
          {data.history.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.history.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{h.label}</p>
                    {h.note ? <p className="truncate text-xs text-ink-muted">{h.note}</p> : null}
                    <p className="text-[11px] text-ink-subtle">{fmtDate(h.at)}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${h.delta < 0 ? "text-ink-muted" : "text-success"}`}>
                    {h.delta > 0 ? "+" : ""}
                    {h.delta} {h.kind === "xp" ? "XP" : "pts"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <Panel title="Leaderboard">
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-[var(--c-accent)]"
                checked={data.leaderboardOptIn}
                disabled={pending}
                onChange={(e) => {
                  const on = e.target.checked;
                  run(() => setLeaderboardOptIn(data.student.id, on), on ? "Added to the batch leaderboard" : "Removed from the leaderboard");
                }}
              />
              <span className="text-sm text-ink">
                Show {data.student.name.split(" ")[0]} on the batch leaderboard
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Only other families in the same batch and age group see it. First name and last initial, XP and attendance streak. Never points, photos or health
                  information. This is separate from photo consent; you can turn it off any time.
                </span>
              </span>
            </label>
          </Panel>
          <Panel title="Expiry reminders">
            <p className="text-sm text-ink-muted">Points expiring in the next 30 days show at the top of this page. Message reminders are coming soon.</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
