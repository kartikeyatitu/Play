"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { recordResult, scoreFixtureLive } from "@/app/actions/fixtures";
import type { FixtureCard } from "@/lib/competition/board";
import { headToHeadLiveSports } from "@/lib/competition/live-link";
import { fmtIst, ghostBtn, inputCls, labelCls, primaryBtn } from "./styles";

/** Enter or correct a score, or open live scoring for the fixture. */
export function ResultSheet({
  fixture,
  canEdit,
  liveScoring,
  onClose,
  onSaved,
}: {
  fixture: FixtureCard | null;
  canEdit: boolean;
  liveScoring: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [winner, setWinner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsSport, setNeedsSport] = useState(false);
  const [sport, setSport] = useState("");

  useEffect(() => {
    setHome(fixture?.homeScore?.toString() ?? "");
    setAway(fixture?.awayScore?.toString() ?? "");
    setWinner(fixture?.winnerEntryId ?? null);
    setNeedsSport(false);
  }, [fixture]);

  if (!fixture) return null;
  const f = fixture;
  const level = home !== "" && away !== "" && Number(home) === Number(away);
  const done = f.status === "COMPLETED";

  const save = async () => {
    setBusy(true);
    const r = await recordResult(f.id, { homeScore: home, awayScore: away, winnerEntryId: level ? winner : null, expectedVersion: f.version });
    setBusy(false);
    if (r.success) {
      toast.success(done ? "Result corrected" : "Result saved");
      onClose();
    } else toast.error(r.error);
    await onSaved();
  };

  const goLive = async () => {
    setBusy(true);
    const r = await scoreFixtureLive(f.id, sport ? { sport } : undefined);
    setBusy(false);
    if (r.success) router.push(`/live/${r.matchId}`);
    else if (r.needsSport) setNeedsSport(true);
    else toast.error(r.error);
  };

  const when = fmtIst(f.scheduledAt);
  return (
    <BottomSheet open={!!fixture} onOpenChange={(o) => !o && onClose()} title={done ? "Result" : "Enter result"} description={[f.group, when, f.venue].filter(Boolean).join(" · ") || undefined}>
      <div className="mx-auto max-w-md space-y-5 pb-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <label className={labelCls} htmlFor="score-home">
              <span className="block truncate normal-case tracking-normal text-sm text-ink">{f.homeName}</span>
            </label>
            <input id="score-home" className={`${inputCls} text-center text-lg font-bold`} inputMode="numeric" pattern="[0-9]*" value={home} disabled={!canEdit} onChange={(e) => setHome(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </div>
          <span className="pb-3 text-ink-subtle">–</span>
          <div>
            <label className={labelCls} htmlFor="score-away">
              <span className="block truncate normal-case tracking-normal text-sm text-ink">{f.awayName}</span>
            </label>
            <input id="score-away" className={`${inputCls} text-center text-lg font-bold`} inputMode="numeric" pattern="[0-9]*" value={away} disabled={!canEdit} onChange={(e) => setAway(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </div>
        </div>

        {level && f.needsWinnerOnTie && (
          <fieldset>
            <legend className={labelCls}>Level — who went through?</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: f.homeEntryId!, name: f.homeName },
                { id: f.awayEntryId!, name: f.awayName },
              ].map((s) => (
                <button key={s.id} type="button" onClick={() => setWinner(s.id)} className={`${ghostBtn} truncate ${winner === s.id ? "border-volt bg-volt/10" : ""}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {canEdit && (
          <button type="button" className={`${primaryBtn} w-full`} disabled={busy || home === "" || away === "" || (level && f.needsWinnerOnTie && !winner)} onClick={save}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {done ? "Save correction" : "Save result"}
          </button>
        )}

        {liveScoring && !done && f.playable && (
          <div className="space-y-2 border-t border-line pt-4">
            {needsSport && (
              <div>
                <label className={labelCls} htmlFor="live-sport">Sport to score</label>
                <select id="live-sport" className={inputCls} value={sport} onChange={(e) => setSport(e.target.value)}>
                  <option value="">Pick a sport</option>
                  {headToHeadLiveSports().map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="button" className={`${ghostBtn} w-full`} disabled={busy || (needsSport && !sport)} onClick={goLive}>
              <Radio className="h-4 w-4" aria-hidden /> {f.live ? "Open live score" : "Score live"}
            </button>
            <p className="text-xs text-ink-subtle">Live scoring keeps its own scoreboard. Enter the final score here when the match ends.</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
