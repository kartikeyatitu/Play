"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock, ShieldCheck, XCircle, Target, Trophy, Plus } from "lucide-react";
import {
  ACHIEVEMENT_LEVELS,
  LEVEL_LABELS,
  STATUS_LABELS,
  type AchievementLevel,
  type AchievementStatus,
  type ReviewAction,
} from "@/lib/athlete";
import {
  deleteAchievement,
  reviewAchievement,
  saveGoal,
  setGoalStatus,
  submitAchievement,
  updateAchievement,
} from "@/app/actions/athlete";

export interface PanelAchievement {
  id: string;
  kind: string;
  title: string;
  competition: string | null;
  level: string;
  result: string | null;
  eventDate: string;
  evidenceUrl: string | null;
  notes: string | null;
  status: string;
  submittedByRole: string;
  rejectionReason: string | null;
  verifiedAt: string | null;
  canEdit: boolean;
}

export interface PanelGoal {
  id: string;
  title: string;
  metric: string | null;
  baseline: number | null;
  target: number | null;
  dueDate: string | null;
  status: string;
  notes: string | null;
  achievedAt: string | null;
}

interface Props {
  studentId: string;
  academyName: string;
  canReview: boolean;
  canVerify: boolean;
  canSetGoals: boolean;
  achievements: PanelAchievement[];
  goals: PanelGoal[];
}

const input = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-600";
const btn = "rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50";
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

function StatusBadge({ status, academyName }: { status: string; academyName: string }) {
  const s = status as AchievementStatus;
  const map: Record<AchievementStatus, { cls: string; icon: React.ReactNode }> = {
    SUBMITTED: { cls: "border-zinc-700 text-zinc-300", icon: <Clock className="h-3 w-3" aria-hidden /> },
    REVIEWED: { cls: "border-sky-800 text-sky-300", icon: <CheckCircle2 className="h-3 w-3" aria-hidden /> },
    VERIFIED: { cls: "border-emerald-700 bg-emerald-950/40 text-emerald-300", icon: <ShieldCheck className="h-3 w-3" aria-hidden /> },
    REJECTED: { cls: "border-rose-800 text-rose-300", icon: <XCircle className="h-3 w-3" aria-hidden /> },
  };
  const m = map[s] ?? map.SUBMITTED;
  const label = s === "VERIFIED" ? `Verified by ${academyName}` : STATUS_LABELS[s] ?? status;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${m.cls}`}>{m.icon}{label}</span>;
}

const emptyAchievement = { kind: "COMPETITION", title: "", competition: "", level: "DISTRICT", result: "", eventDate: "", evidenceUrl: "", notes: "" };
const emptyGoal = { title: "", metric: "", baseline: "", target: "", dueDate: "", notes: "" };

export function AthletePanel(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<typeof emptyAchievement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState<typeof emptyGoal | null>(null);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(ok);
        after?.();
        router.refresh();
      } else toast.error(res.error || "Something went wrong");
    });

  const review = (id: string, action: ReviewAction) => {
    let reason: string | undefined;
    if (action === "reject" || action === "unverify") {
      reason = window.prompt(action === "reject" ? "Why can't this be verified?" : "Why remove verification?") ?? undefined;
      if (!reason) return;
    }
    run(() => reviewAchievement(id, action, reason), { review: "Marked reviewed", verify: "Verified", reject: "Rejected", unverify: "Verification removed" }[action]);
  };

  const saveAchievement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    run(
      () => (editingId ? updateAchievement(editingId, form) : submitAchievement(props.studentId, form)),
      editingId ? "Updated — it will need verifying again" : "Submitted for review",
      () => { setForm(null); setEditingId(null); },
    );
  };

  return (
    <section id="athlete" className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Achievements */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Trophy className="h-4 w-4 text-amber-400" aria-hidden /> Achievements &amp; competitions</h2>
          {!form && (
            <button type="button" className={btn} onClick={() => { setForm(emptyAchievement); setEditingId(null); }}>
              <span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" aria-hidden />Add</span>
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-zinc-500">Only entries marked &ldquo;Verified&rdquo; have been checked by academy staff.</p>

        {form && (
          <form onSubmit={saveAchievement} className="mb-4 space-y-2 rounded-md border border-zinc-800 p-3">
            <div className="grid grid-cols-2 gap-2">
              <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Type">
                <option value="COMPETITION">Competition result</option>
                <option value="ACHIEVEMENT">Achievement</option>
              </select>
              <select className={input} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} aria-label="Level">
                {ACHIEVEMENT_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l as AchievementLevel]}</option>)}
              </select>
            </div>
            <input className={input} required minLength={3} maxLength={120} placeholder="Title, e.g. U-14 District Championship" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={input} maxLength={120} placeholder="Competition / organiser" value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} />
              <input className={input} maxLength={80} placeholder="Result, e.g. Runner-up" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={input} type="date" required value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} aria-label="Date" />
              <input className={input} type="url" placeholder="Evidence link (optional)" value={form.evidenceUrl} onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })} />
            </div>
            <textarea className={input} maxLength={500} rows={2} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50">{editingId ? "Save changes" : "Submit"}</button>
              <button type="button" className={btn} onClick={() => { setForm(null); setEditingId(null); }}>Cancel</button>
            </div>
          </form>
        )}

        <ul className="space-y-3">
          {props.achievements.map((a) => (
            <li key={a.id} className="rounded-md border border-zinc-800 bg-zinc-900/80 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-100">{a.title}</p>
                  <p className="text-xs text-zinc-400">
                    {[LEVEL_LABELS[a.level as AchievementLevel] ?? a.level, a.competition, a.result, day(a.eventDate)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge status={a.status} academyName={props.academyName} />
              </div>
              {a.notes && <p className="mt-2 text-sm text-zinc-300">{a.notes}</p>}
              {a.status === "REJECTED" && a.rejectionReason && <p className="mt-1 text-xs text-rose-300">Reason: {a.rejectionReason}</p>}
              {a.evidenceUrl && <a href={a.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-sky-400 hover:underline">Evidence link</a>}
              <div className="mt-2 flex flex-wrap gap-2">
                {props.canReview && a.status === "SUBMITTED" && <button type="button" disabled={pending} className={btn} onClick={() => review(a.id, "review")}>Mark reviewed</button>}
                {props.canVerify && (a.status === "SUBMITTED" || a.status === "REVIEWED") && (
                  <>
                    <button type="button" disabled={pending} className={`${btn} border-emerald-700 text-emerald-300`} onClick={() => review(a.id, "verify")}>Verify</button>
                    <button type="button" disabled={pending} className={btn} onClick={() => review(a.id, "reject")}>Reject</button>
                  </>
                )}
                {props.canVerify && a.status === "VERIFIED" && <button type="button" disabled={pending} className={btn} onClick={() => review(a.id, "unverify")}>Remove verification</button>}
                {a.canEdit && (
                  <button type="button" disabled={pending} className={btn} onClick={() => {
                    setEditingId(a.id);
                    setForm({ kind: a.kind, title: a.title, competition: a.competition ?? "", level: a.level, result: a.result ?? "", eventDate: a.eventDate.slice(0, 10), evidenceUrl: a.evidenceUrl ?? "", notes: a.notes ?? "" });
                  }}>Edit</button>
                )}
                {(a.canEdit && (a.status !== "VERIFIED" || props.canVerify)) && (
                  <button type="button" disabled={pending} className={`${btn} text-rose-300`} onClick={() => { if (window.confirm("Delete this entry?")) run(() => deleteAchievement(a.id), "Deleted"); }}>Delete</button>
                )}
              </div>
            </li>
          ))}
          {props.achievements.length === 0 && <li className="text-sm text-zinc-500">No achievements recorded yet.</li>}
        </ul>
      </div>

      {/* Goals */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Target className="h-4 w-4 text-sky-400" aria-hidden /> Development goals</h2>
          {props.canSetGoals && !goalForm && (
            <button type="button" className={btn} onClick={() => setGoalForm(emptyGoal)}>
              <span className="inline-flex items-center gap-1"><Plus className="h-3 w-3" aria-hidden />Set goal</span>
            </button>
          )}
        </div>

        {goalForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); run(() => saveGoal(props.studentId, goalForm), "Goal saved", () => setGoalForm(null)); }}
            className="mb-4 space-y-2 rounded-md border border-zinc-800 p-3"
          >
            <input className={input} required minLength={3} maxLength={120} placeholder="Goal, e.g. Improve first-touch control" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <input className={input} maxLength={60} placeholder="Measure (optional)" value={goalForm.metric} onChange={(e) => setGoalForm({ ...goalForm, metric: e.target.value })} />
              <input className={input} inputMode="decimal" placeholder="Now" value={goalForm.baseline} onChange={(e) => setGoalForm({ ...goalForm, baseline: e.target.value })} />
              <input className={input} inputMode="decimal" placeholder="Target" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} />
            </div>
            <input className={input} type="date" value={goalForm.dueDate} onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })} aria-label="Due date" />
            <textarea className={input} maxLength={500} rows={2} placeholder="How we'll work on it (optional)" value={goalForm.notes} onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })} />
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50">Save goal</button>
              <button type="button" className={btn} onClick={() => setGoalForm(null)}>Cancel</button>
            </div>
          </form>
        )}

        <ul className="space-y-3">
          {props.goals.map((g) => (
            <li key={g.id} className={`rounded-md border border-zinc-800 bg-zinc-900/80 p-3 ${g.status === "DROPPED" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-zinc-100">{g.title}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${g.status === "ACHIEVED" ? "border-emerald-700 text-emerald-300" : g.status === "DROPPED" ? "border-zinc-700 text-zinc-400" : "border-sky-800 text-sky-300"}`}>
                  {g.status === "ACHIEVED" ? `Achieved ${day(g.achievedAt)}` : g.status === "DROPPED" ? "Dropped" : "Active"}
                </span>
              </div>
              {(g.metric || g.target !== null) && (
                <p className="text-xs text-zinc-400">
                  {g.metric ?? "Target"}{g.baseline !== null ? `: ${g.baseline}` : ""}{g.target !== null ? ` → ${g.target}` : ""}
                </p>
              )}
              {g.dueDate && <p className="text-xs text-zinc-500">Due {day(g.dueDate)}</p>}
              {g.notes && <p className="mt-1 text-sm text-zinc-300">{g.notes}</p>}
              {props.canSetGoals && (
                <div className="mt-2 flex gap-2">
                  {g.status === "ACTIVE" ? (
                    <>
                      <button type="button" disabled={pending} className={btn} onClick={() => run(() => setGoalStatus(g.id, "ACHIEVED"), "Marked achieved")}>Mark achieved</button>
                      <button type="button" disabled={pending} className={btn} onClick={() => run(() => setGoalStatus(g.id, "DROPPED"), "Goal dropped")}>Drop</button>
                    </>
                  ) : (
                    <button type="button" disabled={pending} className={btn} onClick={() => run(() => setGoalStatus(g.id, "ACTIVE"), "Goal reopened")}>Reopen</button>
                  )}
                </div>
              )}
            </li>
          ))}
          {props.goals.length === 0 && <li className="text-sm text-zinc-500">No goals set yet.</li>}
        </ul>
      </div>
    </section>
  );
}
