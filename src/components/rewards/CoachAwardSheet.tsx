"use client";
// Coach award sheet (spec §7, phone): pick player, pick a reason, optional note. Caps are shown before
// choosing, and enforced again on the server. Big or frequent awards go to the owner for review.
//
// Wire it into the coach screen with, e.g.:
//   {FEATURES.rewards && <CoachAwardSheet players={[{ id, name }]} sport={batch.sport} />}
// or with no props to let it load the coach's own batches.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Award, Medal } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { awardCoachBadge, coachBonus, getAwardRoster, getCoachBonusAllowance } from "@/app/actions/rewards";
import { GhostButton, PrimaryButton } from "./ui";

type Allowance = Extract<Awaited<ReturnType<typeof getCoachBonusAllowance>>, { ok: true }>;
type Player = { id: string; name: string };

const newRequestId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`);

export function CoachAwardSheet({ players: given, sport, trigger }: { players?: Player[]; sport?: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<Player[]>(given ?? []);
  const [studentId, setStudentId] = useState("");
  const [allow, setAllow] = useState<Allowance | null>(null);
  const [allowError, setAllowError] = useState<string | null>(null);
  const [points, setPoints] = useState(3);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"points" | "badge">("points");
  const [badgeKey, setBadgeKey] = useState("team-player");
  const [pending, start] = useTransition();
  const requestId = useRef(newRequestId());

  useEffect(() => {
    if (!open || given) return;
    start(async () => {
      const r = await getAwardRoster();
      if (r.ok) {
        const seen = new Map<string, Player>();
        for (const b of r.batches) for (const p of b.players) seen.set(p.id, p);
        setPlayers([...seen.values()].sort((a, z) => a.name.localeCompare(z.name)));
      } else toast.error(r.error);
    });
  }, [open, given]);

  useEffect(() => {
    setAllow(null);
    setAllowError(null);
    if (!studentId) return;
    start(async () => {
      const r = await getCoachBonusAllowance(studentId);
      if (r.ok) {
        setAllow(r);
        setPoints((p) => Math.max(1, Math.min(p, r.maxPoints, r.weekLeft || 1)));
      } else setAllowError(r.error);
    });
  }, [studentId]);

  const maxPick = allow ? Math.max(0, Math.min(allow.maxPoints, allow.weekLeft, allow.monthRoom)) : 0;
  const willReview = useMemo(() => !!allow && allow.reviewable && (points >= allow.reviewAtPoints || allow.awardsToday + 1 >= 3), [allow, points]);

  const reset = () => {
    setReason("");
    setNote("");
    requestId.current = newRequestId();
  };

  const submit = () =>
    start(async () => {
      if (mode === "badge") {
        const r = await awardCoachBadge({ studentId, badgeKey, reason: note });
        if (!r.ok) return void toast.error(r.error);
        toast.success("Badge awarded");
        reset();
        setOpen(false);
        return;
      }
      const r = await coachBonus({ studentId, points, reason, note, requestId: requestId.current, sport });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.status === "PENDING_REVIEW" ? "Sent to the owner for review" : r.status === "DUPLICATE" ? "Already awarded" : `Awarded ${r.points} points`);
      reset();
      setOpen(false);
    });

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title="Award a player"
      description="Recognise effort with a reason. Parents see the reason."
      trigger={
        trigger ?? (
          <button type="button" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-volt px-4 text-sm font-semibold text-volt-fg">
            <Award className="h-4 w-4" aria-hidden /> Award
          </button>
        )
      }
    >
      <div className="space-y-4 overflow-y-auto pb-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Player</span>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="min-h-[48px] w-full rounded-xl border border-line bg-canvas px-3 text-base text-ink"
          >
            <option value="">Choose a player</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          {(["points", "badge"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`min-h-[44px] flex-1 rounded-xl border text-sm font-medium ${mode === m ? "border-volt bg-volt text-volt-fg" : "border-line text-ink-muted"}`}
            >
              {m === "points" ? "Bonus points" : "Coach badge"}
            </button>
          ))}
        </div>

        {allowError ? <p className="text-sm text-danger">{allowError}</p> : null}

        {mode === "points" ? (
          <>
            {allow ? (
              <p className="text-xs text-ink-muted">
                Up to {allow.maxPoints} points per award · {allow.weekLeft} left from you this week · {allow.monthRoom} left this month
              </p>
            ) : null}
            <div>
              <span className="mb-1 block text-xs font-medium text-ink-muted">Points</span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: allow?.maxPoints ?? 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!allow || n > maxPick}
                    onClick={() => setPoints(n)}
                    className={`h-11 w-11 rounded-xl border text-sm font-semibold tabular-nums disabled:opacity-30 ${points === n ? "border-volt bg-volt text-volt-fg" : "border-line text-ink"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-ink-muted">Reason</span>
              <div className="flex flex-wrap gap-2">
                {(allow?.reasons ?? []).map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setReason(r.key)}
                    className={`min-h-[44px] rounded-full border px-3 text-sm ${reason === r.key ? "border-volt bg-volt text-volt-fg" : "border-line text-ink"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-muted">Badge (one coach badge per player per term)</span>
            <div className="flex gap-2">
              {[
                { key: "team-player", label: "Team player" },
                { key: "most-improved", label: "Most improved" },
              ].map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBadgeKey(b.key)}
                  className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm ${badgeKey === b.key ? "border-volt bg-volt text-volt-fg" : "border-line text-ink"}`}
                >
                  <Medal className="h-4 w-4" aria-hidden /> {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">{mode === "badge" ? "Reason (required)" : "Note (optional)"}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            className="w-full rounded-xl border border-line bg-canvas p-3 text-base text-ink"
          />
        </label>

        {mode === "points" && willReview ? <p className="text-xs text-warn">This award will go to the owner for review before it's added.</p> : null}

        <div className="flex gap-2">
          <PrimaryButton
            disabled={pending || !studentId || (mode === "points" ? !allow || !reason || points > maxPick || maxPick < 1 : note.trim().length < 3)}
            onClick={submit}
          >
            {mode === "points" ? `Award ${points} points` : "Award badge"}
          </PrimaryButton>
          <GhostButton onClick={() => setOpen(false)}>Close</GhostButton>
        </div>
      </div>
    </BottomSheet>
  );
}
