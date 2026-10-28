"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, Link2, Link2Off, Loader2, Share2, Undo2, WifiOff, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LiveSide, LiveView } from "@/lib/live-match";
import { finishLiveMatch, getLiveMatchView, recordLiveEvent, setLiveMatchSharing, undoLiveEvent } from "@/app/actions/live-scoring";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Tap = { clientId: string; side: LiveSide };

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * One screen for everyone: viewers get a live scoreboard that refreshes every few seconds; the scorer
 * (coach, or manager with competitions access) also gets two big tap targets, undo, finish and share.
 * Taps are queued and sent one at a time with a clientId, so a flaky connection retries without
 * double-counting and the score never runs ahead of the server.
 */
export function LiveMatchScreen({ initial, token, backHref }: { initial: LiveView; token?: string | null; backHref?: string | null }) {
  const [view, setView] = useState(initial);
  const [queue, setQueue] = useState<Tap[]>([]);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<null | "undo" | "finish" | "share">(null);
  const [confirm, setConfirm] = useState<null | "finish" | "abandon">(null);
  const sending = useRef(false);
  const versionRef = useRef(initial.version);
  versionRef.current = view.version;

  const live = view.status === "LIVE" || view.status === "SCHEDULED";
  const scorer = view.canScore && live;

  // Send queued taps one at a time.
  useEffect(() => {
    if (!queue.length || sending.current) return;
    sending.current = true;
    const tap = queue[0];
    recordLiveEvent({ matchId: view.id, version: versionRef.current, clientId: tap.clientId, event: { type: "point", side: tap.side } })
      .then((r) => {
        setOffline(false);
        if (r.success) {
          setView(r.view);
          setQueue((q) => q.slice(1));
        } else {
          if (r.view) setView(r.view);
          toast.error(r.error);
          setQueue([]); // the score moved under us (or the match is decided): drop the rest
        }
      })
      .catch(() => setOffline(true)) // network: keep the tap, retry below
      .finally(() => {
        sending.current = false;
      });
  }, [queue, view.id]);

  // Retry while offline.
  useEffect(() => {
    if (!offline) return;
    const t = setInterval(() => setQueue((q) => [...q]), 3000);
    return () => clearInterval(t);
  }, [offline]);

  // Viewers (and an idle scorer, to pick up a second device) poll while the match is on.
  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible" || sending.current) return;
    const r = await getLiveMatchView({ matchId: view.id, token }).catch(() => null);
    if (r?.success && r.view.version >= versionRef.current && !sending.current) setView(r.view);
  }, [view.id, token]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(poll, scorer ? 8000 : 3000);
    return () => clearInterval(t);
  }, [live, scorer, poll]);

  const tap = (side: LiveSide) => {
    if (view.board.winner) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
    setQueue((q) => [...q, { clientId: newId(), side }]);
  };

  const undo = async () => {
    const unsent = sending.current ? queue.length - 1 : queue.length;
    if (unsent > 0) return setQueue((q) => q.slice(0, -1)); // take back a tap that hasn't gone out yet
    if (queue.length) return; // one tap in flight: wait for it
    setBusy("undo");
    const r = await undoLiveEvent({ matchId: view.id, version: view.version }).catch(() => null);
    setBusy(null);
    if (!r) return toast.error("You're offline. Try again in a moment.");
    if (r.success) setView(r.view);
    else {
      if (r.view) setView(r.view);
      toast.error(r.error);
    }
  };

  const finish = async (abandon: boolean) => {
    setBusy("finish");
    const r = await finishLiveMatch({ matchId: view.id, abandon }).catch(() => null);
    setBusy(null);
    if (!r) return toast.error("You're offline. Try again in a moment.");
    if (r.success) {
      setView(r.view);
      toast.success(abandon ? "Match abandoned" : "Match finished. Results saved to each player's record.");
    } else toast.error(r.error);
  };

  const share = async (on: boolean) => {
    setBusy("share");
    const r = await setLiveMatchSharing({ matchId: view.id, share: on }).catch(() => null);
    setBusy(null);
    if (!r?.success) return toast.error(r?.error || "You're offline. Try again in a moment.");
    setView((v) => ({ ...v, shareToken: r.token, visibility: on ? "LINK" : "ACADEMY" }));
    if (on && r.token) await copyLink(r.token);
    else toast.success("Link turned off. The old link no longer works.");
  };

  const copyLink = async (t: string) => {
    const url = `${window.location.origin}/live/${view.id}?t=${t}`;
    try {
      if (navigator.share) await navigator.share({ title: view.title, text: `Live score: ${view.title}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Live link copied");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const b = view.board;
  const pending: Record<LiveSide, number> = { home: 0, away: 0 };
  for (const q of queue) pending[q.side]++;
  const server: LiveSide | null = view.family === "rally" ? view.lastPoint : null;
  const sideName = (s: LiveSide) => (s === "home" ? view.home : view.away);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-4 sm:px-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {backHref && (
              <Link href={backHref} className="-ml-2 rounded-full p-2 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                {view.sportLabel} · Best of {view.bestOf}
                {view.venue ? ` · ${view.venue}` : ""}
              </p>
              <h1 className="truncate text-lg font-bold tracking-tight">{view.title}</h1>
            </div>
          </div>
          <StatusPill status={view.status} />
        </div>

        {/* Scoreboard */}
        <section aria-label="Score" className="overflow-hidden rounded-2xl border border-line bg-surface">
          {(["home", "away"] as const).map((s, i) => (
            <div key={s} className={cn("flex items-center gap-3 px-4 py-4 sm:px-6", i === 1 && "border-t border-line", b.winner === s && "bg-surface-2")}>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  aria-label={server === s ? "Serving" : undefined}
                  className={cn("h-2 w-2 shrink-0 rounded-full", server === s && !b.winner ? "bg-volt" : "bg-transparent")}
                />
                <span className={cn("truncate text-base font-semibold sm:text-lg", b.winner && b.winner !== s && "text-ink-muted")}>{sideName(s)}</span>
                {b.winner === s && <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">Won</span>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {b.periods.map((p, k) => (
                  <span
                    key={k}
                    className={cn(
                      "w-8 text-center text-sm tabular-nums",
                      p[s] > p[s === "home" ? "away" : "home"] ? "font-bold text-ink" : "text-ink-subtle",
                    )}
                  >
                    {p[s]}
                  </span>
                ))}
                {b.games && <span className="w-8 text-center text-sm font-semibold tabular-nums text-ink-muted">{b.games[s]}</span>}
                {!b.winner && (
                  <span className="ml-2 min-w-[3.5rem] rounded-xl bg-canvas px-2 py-1 text-center text-3xl font-black tabular-nums sm:text-4xl">
                    {b.current[s]}
                    {pending[s] > 0 && <span className="ml-1 align-top text-sm font-bold text-volt-ink">+{pending[s]}</span>}
                  </span>
                )}
              </div>
            </div>
          ))}
          {(view.pressure || b.tiebreak) && !b.winner && (
            <div className="flex items-center gap-2 border-t border-line bg-warn/10 px-4 py-2 text-sm font-semibold text-warn sm:px-6">
              <Zap className="h-4 w-4" aria-hidden />
              {b.tiebreak ? "Tiebreak" : `${view.pressure!.kind === "match" ? "Match" : view.unit === "set" ? "Set" : "Game"} point · ${sideName(view.pressure!.side)}`}
            </div>
          )}
        </section>

        {/* Scorer controls */}
        {scorer && (
          <section aria-label="Score a point" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {(["home", "away"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => tap(s)}
                  disabled={!!b.winner}
                  className={cn(
                    "flex h-36 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 text-center transition active:scale-[0.98] disabled:opacity-40 sm:h-44",
                    s === "home" ? "border-volt bg-volt text-volt-fg" : "border-line bg-surface text-ink hover:bg-surface-2",
                  )}
                >
                  <span className="text-4xl font-black">+1</span>
                  <span className="line-clamp-2 text-sm font-semibold">{sideName(s)}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={busy !== null || (view.points === 0 && !queue.length)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-40"
              >
                {busy === "undo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Undo
              </button>
              <button
                type="button"
                onClick={() => setConfirm(b.winner ? "finish" : view.points ? "finish" : "abandon")}
                disabled={busy !== null || queue.length > 0}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-40",
                  b.winner ? "bg-volt text-volt-fg" : "border border-line bg-surface hover:bg-surface-2",
                )}
              >
                {busy === "finish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                {b.winner ? "Finish & save" : view.points ? "End match" : "Cancel match"}
              </button>
              {offline && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warn">
                  <WifiOff className="h-4 w-4" /> Offline · {queue.length} waiting
                </span>
              )}
            </div>
          </section>
        )}

        {/* Sharing (staff only) */}
        {view.staff && view.status !== "ABANDONED" && (
          <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <p className="text-sm text-ink-muted">
              {view.visibility === "LINK" ? "Anyone with the link can watch. Players show as first name and initial." : "Visible to your academy and the players' parents."}
            </p>
            <div className="flex gap-2">
              {view.visibility === "LINK" && view.shareToken ? (
                <>
                  <button type="button" onClick={() => copyLink(view.shareToken!)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold hover:bg-line">
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                  <button type="button" onClick={() => share(false)} disabled={busy !== null} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted hover:text-ink">
                    <Link2Off className="h-4 w-4" /> Turn off
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => share(true)} disabled={busy !== null} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold hover:bg-line">
                  {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Get live link
                </button>
              )}
            </div>
          </section>
        )}

        {/* Match analytics */}
        {view.points > 0 && <MatchInsights view={view} />}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => finish(confirm === "abandon")}
        title={confirm === "abandon" ? "Cancel this match?" : b.winner ? "Finish and save?" : "End the match now?"}
        description={
          confirm === "abandon"
            ? "Nothing has been scored. The match will be removed from the live list."
            : b.winner
              ? `${sideName(b.winner)} won ${b.periodsWon[b.winner]}–${b.periodsWon[b.winner === "home" ? "away" : "home"]}. Results are saved to each linked player's record.`
              : "The match isn't decided yet. It will be saved as it stands, with no winner."
        }
        confirmLabel={confirm === "abandon" ? "Cancel match" : "Finish"}
        variant={confirm === "abandon" ? "danger" : "default"}
      />
    </div>
  );
}

function StatusPill({ status }: { status: LiveView["status"] }) {
  if (status === "LIVE")
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-danger">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
        </span>
        Live
      </span>
    );
  const label = status === "COMPLETED" ? "Final" : status === "ABANDONED" ? "Cancelled" : "Not started";
  return <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</span>;
}

function MatchInsights({ view }: { view: LiveView }) {
  const m = view.momentum;
  const total = m.pointsWon.home + m.pointsWon.away;
  const pct = (s: LiveSide) => (total ? Math.round((m.pointsWon[s] / total) * 100) : 0);
  const name = (s: LiveSide) => (s === "home" ? view.home : view.away);
  return (
    <section aria-label="Match stats" className="mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-subtle">Match stats</h2>
      {m.currentRun && m.currentRun.length >= 3 && view.status === "LIVE" && (
        <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold">
          {name(m.currentRun.side)} on a run: {m.currentRun.length} points in a row
        </p>
      )}
      <dl className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-3 text-sm">
        <StatRow label="Points won" home={`${m.pointsWon.home} (${pct("home")}%)`} away={`${m.pointsWon.away} (${pct("away")}%)`} />
        <StatRow label="Longest run" home={String(m.longestRun.home)} away={String(m.longestRun.away)} />
        <StatRow label={view.unit === "set" ? "Sets" : "Games"} home={String(view.board.periodsWon.home)} away={String(view.board.periodsWon.away)} />
      </dl>
      {m.diff.length >= 4 && <Momentum diff={m.diff} home={view.home} away={view.away} />}
    </section>
  );
}

function StatRow({ label, home, away }: { label: string; home: string; away: string }) {
  return (
    <>
      <dd className="text-left font-semibold tabular-nums">{home}</dd>
      <dt className="text-center text-xs text-ink-subtle">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{away}</dd>
    </>
  );
}

/** Running point difference: above the line = first side ahead. */
function Momentum({ diff, home, away }: { diff: number[]; home: string; away: string }) {
  const W = 600;
  const H = 120;
  const max = Math.max(3, ...diff.map((d) => Math.abs(d)));
  const x = (i: number) => (diff.length === 1 ? W : (i / (diff.length - 1)) * W);
  const y = (d: number) => H / 2 - (d / max) * (H / 2 - 6);
  const path = diff.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d).toFixed(1)}`).join(" ");
  const last = diff[diff.length - 1];
  return (
    <figure className="mt-5">
      <figcaption className="mb-2 flex justify-between text-xs text-ink-subtle">
        <span>Momentum</span>
        <span className="tabular-nums">
          {last === 0 ? "Level" : `${last > 0 ? home : away} +${Math.abs(last)}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none" role="img" aria-label={`Point difference over the match. ${home} above the line, ${away} below.`}>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" stroke="var(--viz-billed)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ink-subtle">
        <span>▲ {home}</span>
        <span>▼ {away}</span>
      </div>
    </figure>
  );
}
