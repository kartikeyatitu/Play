"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, Link2, Link2Off, Loader2, Share2, Undo2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LiveView } from "@/lib/live-match";
import { addLivePlayer, finishLiveMatch, getLiveMatchView, recordLiveEvent, setLiveMatchSharing, undoLiveEvent } from "@/app/actions/live-scoring";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { PanelProps } from "./live-ui";
import { RallyPanel } from "./RallyPanel";
import { CricketPanel } from "./CricketPanel";
import { GoalsPanel } from "./GoalsPanel";
import { BoutPanel } from "./BoutPanel";
import { PerformancePanel } from "./PerformancePanel";
import { ChessPanel } from "./ChessPanel";

type Queued = { clientId: string; event: Record<string, unknown> };

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function formatLabel(v: LiveView): string {
  const d = v.detail;
  switch (d.family) {
    case "rally":
    case "tennis":
      return `Best of ${d.bestOf}`;
    case "cricket":
      return `${d.config.oversPerInnings} overs a side`;
    case "goals":
      return d.config.periodMinutes ? `${d.config.periods} × ${d.config.periodMinutes} min` : `${d.config.periods} ${d.config.periodLabel.toLowerCase()}s`;
    case "bout":
      return `${d.config.rounds} ${v.unit}${d.config.rounds === 1 ? "" : "s"}`;
    case "performance":
      return d.config.eventName;
    case "chess":
      return "Single game";
  }
}

function outcomeText(v: LiveView): string {
  if (v.family === "performance") return "Results are saved, with personal bests flagged for academy athletes.";
  if (v.outcome === "draw") return "It finished level. Results are saved to each academy player's record.";
  if (v.outcome) return `${v.outcome === "home" ? v.home : v.away} won${v.line ? ` (${v.line})` : ""}. Results are saved to each academy player's record.`;
  if (v.family === "bout") return "Finishing decides the bout on points, or on the judges' cards if they were entered. Results are saved to each academy player's record.";
  return "The match isn't decided yet. It will be saved as it stands, with no winner.";
}

/**
 * One screen for everyone: viewers get a live scoreboard that refreshes every few seconds; the scorer
 * (coach, or manager with competitions access) also gets the sport's controls, undo, finish and share.
 * Entries are queued and sent one at a time with a clientId, so a flaky connection retries without
 * double-counting and the score never runs ahead of the server.
 */
export function LiveMatchScreen({ initial, token, backHref }: { initial: LiveView; token?: string | null; backHref?: string | null }) {
  const [view, setView] = useState(initial);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<null | "undo" | "finish" | "share">(null);
  const [confirm, setConfirm] = useState<null | "finish" | "abandon">(null);
  const sending = useRef(false);
  const versionRef = useRef(initial.version);
  versionRef.current = view.version;

  const live = view.status === "LIVE" || view.status === "SCHEDULED";
  const scorer = view.canScore && live;

  useEffect(() => {
    if (!queue.length || sending.current) return;
    sending.current = true;
    const item = queue[0];
    recordLiveEvent({ matchId: view.id, version: versionRef.current, clientId: item.clientId, event: item.event })
      .then((r) => {
        setOffline(false);
        if (r.success) {
          setView(r.view);
          setQueue((q) => q.slice(1));
        } else {
          if (r.view) setView(r.view);
          toast.error(r.error);
          setQueue([]); // the score moved under us, or the entry was refused: drop the rest
        }
      })
      .catch(() => setOffline(true))
      .finally(() => {
        sending.current = false;
      });
  }, [queue, view.id]);

  useEffect(() => {
    if (!offline) return;
    const t = setInterval(() => setQueue((q) => [...q]), 3000);
    return () => clearInterval(t);
  }, [offline]);

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

  const send = useCallback((event: Record<string, unknown>) => setQueue((q) => [...q, { clientId: newId(), event }]), []);

  const addPlayer: PanelProps["addPlayer"] = async (side, name) => {
    const r = await addLivePlayer({ matchId: view.id, side, name }).catch(() => null);
    if (!r) {
      toast.error("You're offline. Try again in a moment.");
      return false;
    }
    if (!r.success) {
      toast.error(r.error);
      return false;
    }
    setView(r.view);
    return true;
  };

  const undo = async () => {
    const unsent = sending.current ? queue.length - 1 : queue.length;
    if (unsent > 0) return setQueue((q) => q.slice(0, -1));
    if (queue.length) return;
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
      toast.success(abandon ? "Match cancelled" : "Match finished. Results saved.");
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

  const panel: PanelProps = { view, scorer, send, pending: queue.map((q) => q.event), addPlayer };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className={cn("mx-auto px-4 pb-10 pt-4 sm:px-6", view.family === "cricket" ? "max-w-4xl" : "max-w-3xl")}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {backHref && (
              <Link href={backHref} className="-ml-2 rounded-full p-2 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                {view.sportLabel} · {formatLabel(view)}
                {view.venue ? ` · ${view.venue}` : ""}
              </p>
              <h1 className="truncate text-lg font-bold tracking-tight">{view.title}</h1>
            </div>
          </div>
          <StatusPill status={view.status} />
        </div>

        {view.family === "rally" || view.family === "tennis" ? (
          <RallyPanel {...panel} />
        ) : view.family === "cricket" ? (
          <CricketPanel {...panel} />
        ) : view.family === "goals" ? (
          <GoalsPanel {...panel} />
        ) : view.family === "bout" ? (
          <BoutPanel {...panel} />
        ) : view.family === "performance" ? (
          <PerformancePanel {...panel} />
        ) : (
          <ChessPanel {...panel} />
        )}

        {scorer && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
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
              onClick={() => setConfirm(view.points ? "finish" : "abandon")}
              disabled={busy !== null || queue.length > 0}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-40",
                view.decided ? "bg-volt text-volt-fg" : "border border-line bg-surface hover:bg-surface-2",
              )}
            >
              {busy === "finish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              {view.decided || view.family === "performance" || view.family === "bout" ? "Finish & save" : view.points ? "End match" : "Cancel match"}
            </button>
            {queue.length > 0 && !offline && <span className="text-sm text-ink-subtle">Saving…</span>}
            {offline && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warn">
                <WifiOff className="h-4 w-4" /> Offline · {queue.length} waiting
              </span>
            )}
          </div>
        )}

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
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => finish(confirm === "abandon")}
        title={confirm === "abandon" ? "Cancel this match?" : view.decided || view.family === "performance" ? "Finish and save?" : "End the match now?"}
        description={confirm === "abandon" ? "Nothing has been scored. The match will be removed from the live list." : outcomeText(view)}
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
