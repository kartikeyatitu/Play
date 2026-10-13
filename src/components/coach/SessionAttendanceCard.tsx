"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCheck,
  Loader2,
  AlertTriangle,
  IndianRupee,
  Sparkles,
  XCircle,
  RotateCcw,
  MessageSquareText,
  Send,
  UserPlus,
  Check,
  X,
  Share2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  PenLine,
} from "lucide-react";
import { AttendanceToggle } from "@/components/coach/AttendanceToggle";
import { ShareRecapButton } from "@/components/coach/ShareRecapButton";
import { markBatchAttendance } from "@/app/actions/attendance";
import {
  cancelTodaySession,
  restoreTodaySession,
  saveSessionRecap,
  recordTrialOutcome,
} from "@/app/actions/coach-session";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { statusIsPresent, shortMedicalLabel, firstName, type AttendanceStatus } from "@/lib/coach";

export interface TodayStudent {
  id: string;
  name: string;
  status: AttendanceStatus | null;
  /** Real alert only (allergy / asthma / epilepsy / active condition). */
  medical: string | null;
  /** Info-level medical note, e.g. "Recovered fracture (cleared)". Never counted as "to watch". */
  medicalNote: string | null;
  /** Active injury logged in the last 21 days (alert). */
  injury: string | null;
  feeDue: boolean;
}

export interface TodayTrial {
  id: string;
  childName: string;
  childAge: number;
  parentName: string;
  status: string;
}

export interface TodaySession {
  key: string;
  batchId: string;
  batchName: string;
  sport: string;
  time: string | null;
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  cancelReason: string | null;
  recap: string | null;
  students: TodayStudent[];
  trials: TodayTrial[];
}

export interface TodayShareContext {
  coachName: string;
  academyName: string;
  showPoweredBy: boolean;
  dateLabel: string;
}

const FOCUS_CHIPS = ["Technique", "Footwork", "Fitness", "Match practice", "Teamwork", "Game sense"];

const BRAND_BORDER = { borderColor: "color-mix(in srgb, var(--brand) 40%, transparent)" } as const;

const AVATAR_TONES = [
  "bg-sky-500/20 text-sky-200",
  "bg-emerald-500/20 text-emerald-200",
  "bg-violet-500/20 text-violet-200",
  "bg-amber-500/20 text-amber-200",
  "bg-rose-500/20 text-rose-200",
  "bg-cyan-500/20 text-cyan-200",
];

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

function toneFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

interface WatchItem {
  key: string;
  studentId: string;
  name: string;
  label: string;
  detail: string;
}

export function SessionAttendanceCard({
  session,
  isNextUp = false,
  shareContext,
}: {
  session: TodaySession;
  isNextUp?: boolean;
  shareContext?: TodayShareContext;
}) {
  const router = useRouter();
  const [markingAll, setMarkingAll] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);

  const cancelled = session.status === "CANCELLED";
  const hero = isNextUp && !cancelled;
  const total = session.students.length;
  const marked = session.students.filter((s) => s.status !== null).length;
  const present = session.students.filter((s) => s.status && statusIsPresent(s.status)).length;
  const late = session.students.filter((s) => s.status === "LATE").length;
  const allMarked = total > 0 && marked === total;
  const remaining = total - marked;
  const pendingTrials = session.trials.filter((t) => t.status === "PENDING" || t.status === "CONFIRMED");

  const { alerts, watchCount, watchSummary, notes } = useMemo(() => {
    const items: WatchItem[] = [];
    const summaryParts: string[] = [];
    let count = 0;
    for (const s of session.students) {
      const own: WatchItem[] = [];
      if (s.medical) {
        own.push({ key: `m-${s.id}`, studentId: s.id, name: s.name, label: shortMedicalLabel(s.medical), detail: s.medical });
      }
      if (s.injury) {
        own.push({ key: `i-${s.id}`, studentId: s.id, name: s.name, label: "injury", detail: s.injury });
      }
      if (own.length > 0) {
        count++;
        if (summaryParts.length < 2) summaryParts.push(`${firstName(s.name)} ${own[0].label}`);
        items.push(...own);
      }
    }
    const rest = count - summaryParts.length;
    return {
      alerts: items,
      watchCount: count,
      watchSummary: summaryParts.join(", ") + (rest > 0 ? ` +${rest}` : ""),
      notes: session.students
        .filter((s) => s.medicalNote)
        .map((s) => ({ id: s.id, name: s.name, note: s.medicalNote as string })),
    };
  }, [session.students]);

  async function handleMarkAllPresent() {
    const unmarked = session.students.filter((s) => s.status === null).map((s) => s.id);
    const ids = unmarked.length > 0 ? unmarked : session.students.map((s) => s.id);
    if (ids.length === 0) return;
    setMarkingAll(true);
    try {
      const res = await markBatchAttendance(session.batchId, ids, "PRESENT");
      if (res.success) {
        toast.success(
          unmarked.length > 0 && unmarked.length < total
            ? `Marked remaining ${ids.length} present`
            : `All ${ids.length} athletes marked present`
        );
        router.refresh();
      } else toast.error(res.error);
    } catch {
      toast.error("Network error while marking attendance.");
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    try {
      const res = await restoreTodaySession(session.batchId);
      if (res.success) {
        toast.success("Session restored");
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && !allMarked) setRosterOpen(true);
  }

  const dialogs = (
    <>
      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} session={session} />
      <RecapDialog open={recapOpen} onOpenChange={setRecapOpen} session={session} present={present} late={late} />
    </>
  );

  /* ───────────── Cancelled ───────────── */
  if (cancelled) {
    return (
      <section className="rounded-3xl bg-zinc-900/30 p-4 sm:p-5 min-w-0">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400">
              Cancelled
            </span>
            <h3 className="mt-1.5 text-base font-bold leading-snug text-zinc-500 line-through break-words">
              {session.time ? `${session.time} · ` : ""}
              {session.batchName}
            </h3>
            <p className="mt-1 text-xs text-zinc-500 break-words">
              {session.cancelReason || "No reason given"} · Parents notified
            </p>
          </div>
          <button
            type="button"
            onClick={handleRestore}
            disabled={busy}
            className="shrink-0 h-9 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore
          </button>
        </div>
      </section>
    );
  }

  /* ───────────── Shared body (hero + expanded collapsed card) ───────────── */
  const watchRow =
    watchCount > 0 ? (
      <div className="rounded-2xl bg-amber-500/10 min-w-0">
        <button
          type="button"
          onClick={() => setWatchOpen((v) => !v)}
          aria-expanded={watchOpen}
          className="w-full min-w-0 flex items-center gap-2 px-3 py-2.5 text-left text-sm text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="min-w-0 flex-1 break-words leading-snug">
            <span className="font-bold">{watchCount} to watch</span>
            <span className="text-amber-200/80"> — {watchSummary}</span>
          </span>
          <ChevronRight
            className={`w-4 h-4 text-amber-400 shrink-0 transition-transform ${watchOpen ? "rotate-90" : ""}`}
          />
        </button>
        {watchOpen && (
          <div className="px-3 pb-3 space-y-3">
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.key} className="text-xs leading-relaxed break-words min-w-0">
                  <span className="font-semibold text-amber-100">{a.name}</span>
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                    {a.label}
                  </span>
                  <div className="text-amber-100/70">{a.detail}</div>
                </li>
              ))}
            </ul>
            {notes.length > 0 && (
              <div className="pt-2 border-t border-amber-500/15">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Notes</div>
                <ul className="space-y-1">
                  {notes.map((n) => (
                    <li key={n.id} className="text-xs text-zinc-400 break-words">
                      <span className="text-zinc-300">{firstName(n.name)}</span> · {n.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    ) : null;

  const primaryBtn =
    "w-full h-12 rounded-2xl bg-[var(--brand)] text-[var(--brand-foreground)] font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50";
  const ghostBtn =
    "w-full h-11 rounded-2xl border border-zinc-700/70 text-zinc-200 hover:bg-zinc-800/60 font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50";

  const markAllButton = (
    <button type="button" onClick={handleMarkAllPresent} disabled={markingAll || total === 0} className={ghostBtn}>
      {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
      {marked > 0 && marked < total ? `Mark rest present (${remaining})` : "Mark all present"}
    </button>
  );

  const roster = (
    <ul className="rounded-2xl bg-zinc-950/40 px-3 py-1 divide-y divide-zinc-800/40 min-w-0">
      {session.students.map((s) => {
        const alertText = [s.medical, s.injury].filter(Boolean).join(" · ");
        return (
          <li key={s.id} className="py-2 flex items-center justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <span className="min-w-0 text-sm font-medium text-zinc-100 break-words leading-snug">{s.name}</span>
              {alertText && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                  title={alertText}
                  aria-label={`To watch: ${alertText}`}
                  role="img"
                />
              )}
              {s.feeDue && <IndianRupee className="w-3 h-3 text-zinc-500 shrink-0" aria-label="Fee due" />}
            </div>
            <AttendanceToggle batchId={session.batchId} studentId={s.id} initialStatus={s.status} />
          </li>
        );
      })}
    </ul>
  );

  let actionArea: ReactNode = null;
  if (total === 0) {
    actionArea = <p className="py-2 text-center text-xs text-zinc-500">No athletes enrolled in this batch yet.</p>;
  } else if (!allMarked) {
    actionArea = rosterOpen ? (
      <div className="space-y-2">
        {roster}
        {markAllButton}
        <button
          type="button"
          onClick={() => setRosterOpen(false)}
          className="w-full h-9 text-xs font-semibold text-zinc-500 hover:text-zinc-300"
        >
          Hide list
        </button>
      </div>
    ) : (
      <div className="space-y-2">
        <button type="button" onClick={() => setRosterOpen(true)} className={primaryBtn}>
          <ClipboardCheck className="w-5 h-5" />
          {marked > 0 ? `Continue attendance · ${remaining} left` : "Take attendance"}
        </button>
        {markAllButton}
      </div>
    );
  } else {
    actionArea = (
      <div className="space-y-2">
        {!session.recap && (
          <button type="button" onClick={() => setRecapOpen(true)} className={primaryBtn}>
            <MessageSquareText className="w-5 h-5" /> Add recap
          </button>
        )}
        {rosterOpen && roster}
      </div>
    );
  }

  const recapBlock = session.recap ? (
    <div className="rounded-2xl bg-zinc-950/40 p-3 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> Recap saved
        </span>
        <button
          type="button"
          onClick={() => setRecapOpen(true)}
          className="h-8 px-2.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-1"
        >
          <PenLine className="w-3.5 h-3.5" /> Edit
        </button>
      </div>
      <p className="text-sm text-zinc-300 whitespace-pre-line break-words leading-relaxed">{session.recap}</p>
      {shareContext && (
        <ShareRecapButton
          className="w-full"
          data={{
            batchName: session.batchName,
            sport: session.sport,
            dateLabel: shareContext.dateLabel,
            present,
            total,
            recap: session.recap,
            coachName: shareContext.coachName,
            academyName: shareContext.academyName,
            showPoweredBy: shareContext.showPoweredBy,
          }}
        />
      )}
    </div>
  ) : null;

  const trialsBlock =
    session.trials.length > 0 ? (
      <div className="rounded-2xl bg-purple-500/[0.06] p-3 space-y-2 min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5" /> Trial athletes today
        </div>
        {session.trials.map((t) => (
          <TrialRow key={t.id} trial={t} />
        ))}
      </div>
    ) : null;

  const footer = (
    <div className="flex items-center justify-between gap-2 pt-1">
      {allMarked ? (
        <button
          type="button"
          onClick={() => setRosterOpen((v) => !v)}
          className="h-8 px-2 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-200"
        >
          {rosterOpen ? "Hide attendance" : "Edit attendance"}
        </button>
      ) : !session.recap && total > 0 ? (
        <button
          type="button"
          onClick={() => setRecapOpen(true)}
          className="h-8 px-2 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5"
        >
          <MessageSquareText className="w-3.5 h-3.5" /> Write recap
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={() => setCancelOpen(true)}
        className="h-8 px-2 rounded-lg text-xs font-semibold text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5"
      >
        <XCircle className="w-3.5 h-3.5" /> Cancel session
      </button>
    </div>
  );

  const body = (
    <div className="space-y-3 min-w-0">
      {watchRow}
      {actionArea}
      {recapBlock}
      {trialsBlock}
      {footer}
    </div>
  );

  /* ───────────── Hero (up next) ───────────── */
  if (hero) {
    return (
      <section
        className="relative rounded-3xl bg-zinc-900/70 border p-4 sm:p-5 min-w-0 shadow-[0_0_40px_-12px_var(--brand)]"
        style={BRAND_BORDER}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Up next · {session.time || "Today"}
            </div>
            <h3 className="mt-1 text-xl font-black leading-tight break-words text-white">{session.batchName}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 text-xs font-semibold text-zinc-300 capitalize">
                {session.sport}
              </span>
              {late > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-xs font-semibold text-amber-300">
                  {late} late
                </span>
              )}
              {pendingTrials.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-xs font-semibold text-purple-300">
                  {pendingTrials.length} trial{pendingTrials.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <ProgressRing value={present} total={total} />
        </div>
        <div className="mt-4">{body}</div>
        {dialogs}
      </section>
    );
  }

  /* ───────────── Collapsed (later sessions) ───────────── */
  const chip = allMarked ? (
    <span className="shrink-0 h-8 px-3 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center gap-1">
      Done <Check className="w-3.5 h-3.5" />
    </span>
  ) : (
    <span className="shrink-0 h-8 px-3.5 rounded-full bg-zinc-800 text-zinc-100 text-xs font-bold flex items-center">
      {marked > 0 ? "Resume" : "Start"}
    </span>
  );

  return (
    <section className="rounded-3xl bg-zinc-900/60 min-w-0">
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        className="w-full min-w-0 text-left p-4 sm:p-5 flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-3 min-w-0 w-full">
          <h3 className="min-w-0 flex-1 text-base font-bold leading-snug text-white break-words">
            {session.time && <span className="text-zinc-400 font-semibold">{session.time} · </span>}
            {session.batchName}
          </h3>
          <ChevronDown
            className={`w-5 h-5 mt-0.5 text-zinc-500 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
        <div className="flex items-center justify-between gap-3 min-w-0 w-full">
          <div className="flex items-center gap-2.5 min-w-0">
            <AvatarStack students={session.students} />
            <span className="text-sm text-zinc-400 whitespace-nowrap">
              {total} athlete{total === 1 ? "" : "s"}
              {marked > 0 && !allMarked ? ` · ${present} in` : ""}
            </span>
            {watchCount > 0 && (
              <span
                className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                role="img"
                aria-label={`${watchCount} to watch`}
              />
            )}
          </div>
          {chip}
        </div>
      </button>
      {expanded && <div className="px-4 pb-4 sm:px-5 sm:pb-5">{body}</div>}
      {dialogs}
    </section>
  );
}

function ProgressRing({ value, total, size = 72 }: { value: number; total: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} of ${total} in`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "rgb(39 39 42)" }} />
        {value > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
            style={{ stroke: "var(--brand)", transition: "stroke-dashoffset 500ms ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-black text-white tabular-nums leading-none">
          {value}
          <span className="text-xs font-semibold text-zinc-500">/{total}</span>
        </span>
      </div>
    </div>
  );
}

function AvatarStack({ students }: { students: TodayStudent[] }) {
  if (students.length === 0) return null;
  return (
    <div className="flex -space-x-2 shrink-0" aria-hidden>
      {students.slice(0, 4).map((s) => (
        <span
          key={s.id}
          className={`w-7 h-7 rounded-full ring-2 ring-zinc-900 flex items-center justify-center text-[10px] font-bold ${toneFor(s.id)}`}
        >
          {initials(s.name)}
        </span>
      ))}
    </div>
  );
}

function TrialRow({ trial }: { trial: TodayTrial }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<null | "ATTENDED" | "NO_SHOW">(null);
  const done = !(trial.status === "PENDING" || trial.status === "CONFIRMED");

  async function submit(outcome: "ATTENDED" | "NO_SHOW") {
    setBusy(outcome);
    try {
      const res = await recordTrialOutcome(trial.id, outcome, feedback);
      if (res.success) {
        toast.success(outcome === "ATTENDED" ? "Trial feedback sent to the academy" : "Marked as no-show");
        router.refresh();
      } else toast.error(res.error);
    } catch {
      toast.error("Could not save trial outcome.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {trial.childName} <span className="text-zinc-500 font-normal">· {trial.childAge}y</span>
          </div>
          <div className="text-[11px] text-zinc-500 truncate">Parent: {trial.parentName}</div>
        </div>
        {done ? (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              trial.status === "NO_SHOW"
                ? "text-zinc-400 border-zinc-700"
                : "text-purple-300 border-purple-500/30 bg-purple-500/10"
            }`}
          >
            {trial.status === "NO_SHOW" ? "No-show" : trial.status === "ENROLLED" ? "Enrolled" : "Feedback sent"}
          </span>
        ) : null}
      </div>
      {!done && (
        <>
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Quick feedback for the owner (e.g. good coordination, ready for U-12)"
            className="w-full h-9 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submit("ATTENDED")}
              disabled={!!busy}
              className="h-8 px-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-zinc-950 text-xs font-bold flex items-center gap-1"
            >
              {busy === "ATTENDED" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Attended
            </button>
            <button
              type="button"
              onClick={() => submit("NO_SHOW")}
              disabled={!!busy}
              className="h-8 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1"
            >
              {busy === "NO_SHOW" ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} No-show
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  session,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: TodaySession;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const presets = ["Rain / waterlogged ground", "Ground unavailable", "Coach unwell", "Public holiday"];

  async function submit() {
    setBusy(true);
    try {
      const res = await cancelTodaySession(session.batchId, reason, notify);
      if (res.success) {
        toast.success(notify ? "Session cancelled · parents notified" : "Session cancelled");
        onOpenChange(false);
        setReason("");
        router.refresh();
      } else toast.error(res.error);
    } catch {
      toast.error("Could not cancel the session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-white">Cancel today&apos;s session?</DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            {session.batchName} · {session.time || "today"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className={`text-xs px-2.5 py-1.5 rounded-xl border transition-colors ${
                  reason === p
                    ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason (shared with parents)"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-lime-400" />
            Notify all {session.students.length} parents in the app
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full h-10 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Cancel session
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecapDialog({
  open,
  onOpenChange,
  session,
  present,
  late,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: TodaySession;
  present: number;
  late: number;
}) {
  const router = useRouter();
  const [focus, setFocus] = useState<string[]>([]);
  const [highlights, setHighlights] = useState("");
  const [nextUp, setNextUp] = useState("");
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState<string | null>(session.recap);

  const generated = useMemo(() => {
    const lines = [
      `🏟️ ${session.batchName} — today's session`,
      `✅ Attendance: ${present}/${session.students.length}${late ? ` (${late} late)` : ""}`,
    ];
    if (focus.length) lines.push(`🎯 Focus: ${focus.join(", ")}`);
    if (highlights.trim()) lines.push(`⭐ Highlights: ${highlights.trim()}`);
    if (nextUp.trim()) lines.push(`📅 Next session: ${nextUp.trim()}`);
    return lines.join("\n");
  }, [session, present, late, focus, highlights, nextUp]);

  const text = edited ?? generated;

  async function submit() {
    setBusy(true);
    try {
      const res = await saveSessionRecap(session.batchId, text, share);
      if (res.success) {
        toast.success(share ? "Recap shared with parents" : "Recap saved");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    } catch {
      toast.error("Could not save recap.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-lime-400" /> Session recap
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Takes 20 seconds. Parents love it — it&apos;s the #1 reason they renew.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Focus today</div>
            <div className="flex flex-wrap gap-1.5">
              {FOCUS_CHIPS.map((c) => {
                const on = focus.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setEdited(null);
                      setFocus((f) => (on ? f.filter((x) => x !== c) : [...f, c]));
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border transition-colors ${
                      on
                        ? "bg-lime-400/15 border-lime-400/40 text-lime-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            value={highlights}
            onChange={(e) => {
              setEdited(null);
              setHighlights(e.target.value);
            }}
            placeholder="Highlights (e.g. Aarav's first clean catch, great energy)"
            className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <input
            value={nextUp}
            onChange={(e) => {
              setEdited(null);
              setNextUp(e.target.value);
            }}
            placeholder="Next session note (e.g. Bring water bottles, match on Sat)"
            className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Preview (editable)</div>
            <textarea
              value={text}
              onChange={(e) => setEdited(e.target.value)}
              rows={6}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm text-zinc-200 font-mono leading-relaxed focus:outline-none focus:border-zinc-600"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="accent-lime-400" />
            Post to parents of this batch in the Triq app
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !text.trim()}
              className="flex-1 h-10 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {share ? "Save & share" : "Save"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Share to your batch WhatsApp group"
              className="h-10 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" /> WhatsApp
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
