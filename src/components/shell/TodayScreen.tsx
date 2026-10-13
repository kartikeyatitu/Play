"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, CreditCard, UserPlus, CalendarClock, ClipboardCheck, Clock } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { istDateString, scheduleRunsOn, istWeekday } from "@/lib/fees";
import { KpiTile } from "@/components/shell/KpiTile";
import { AttentionItem } from "@/components/shell/AttentionItem";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { EmptyState, shellButton } from "@/components/shell/EmptyState";
import { InlineAttendance } from "@/components/shell/InlineAttendance";

/** Server-computed, academy-wide numbers (see loadTodayInsights in src/app/org/page.tsx). */
export interface TodayInsights {
  todaySessions: { batchId: string; status: string; marked: number; present: number }[];
  lowAttendanceCount: number;
  lowAttendance: { id: string; name: string; pct: number; sessions: number }[];
}

export interface TodayScreenProps {
  ownerName?: string | null;
  batches: any[];
  allFeeRecords: any[];
  pendingVerification: any[];
  leads: any[];
  trials: any[];
  insights: TodayInsights | null;
  currentMonth: string;
  pendingDues: number;
  onNavigate: (tab: string) => void;
  /** Rendered above the screen (e.g. the onboarding checklist for empty academies). */
  top?: ReactNode;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
/** Compact only when a tile would overflow (≥ 1 lakh): ₹1.25L / ₹2.4Cr */
const inrCompact = (n: number) => {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2).replace(/\.?0+$/, "")}L`;
  return inr(n);
};

function istParts(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now)) % 24;
  const dateLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(now);
  return { hour, dateLabel };
}

export function TodayScreen({
  ownerName, batches, allFeeRecords, pendingVerification, leads, trials, insights, currentMonth, pendingDues, onNavigate, top,
}: TodayScreenProps) {
  const { hour, dateLabel } = istParts();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (ownerName || "").trim().split(/\s+/)[0];

  // ── KPIs (real data only) ───────────────────────────────────────────────────────
  const todayStr = istDateString();
  const paidToday = allFeeRecords.filter((f) => f.status === "PAID" && f.paidAt && istDateString(new Date(f.paidAt)) === todayStr);
  const collectedToday = paidToday.reduce((s, f) => s + (f.amount || 0), 0);

  const unpaid = allFeeRecords.filter((f) => f.status !== "PAID");
  const overdue = unpaid.filter((f) => f.status === "PENDING" && f.month < currentMonth);
  const overdueAmount = overdue.reduce((s, f) => s + (f.amount || 0), 0);
  const pendingThisMonth = unpaid.filter((f) => f.status === "PENDING" && f.month === currentMonth);

  const sessionsToday = insights?.todaySessions ?? [];
  const markedTotal = sessionsToday.reduce((s, x) => s + x.marked, 0);
  const presentTotal = sessionsToday.reduce((s, x) => s + x.present, 0);
  const attendancePct = markedTotal > 0 ? Math.round((presentTotal / markedTotal) * 100) : null;

  // ── Today's sessions: batches whose schedule runs today (IST) ──────────────────
  const weekday = istWeekday();
  const parsed = batches.map((b) => ({ b, runs: scheduleRunsOn(b.schedule, weekday) }));
  const anyParsed = parsed.some((p) => p.runs !== null);
  const todayBatches: any[] = anyParsed ? parsed.filter((p) => p.runs).map((p) => p.b) : batches;
  const sessionFor = (batchId: string) => sessionsToday.find((s) => s.batchId === batchId);
  // Extra / make-up sessions: any batch not scheduled today can be opened for attendance.
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const scheduledIds = new Set(todayBatches.map((b: any) => b.id));
  const listedBatches: any[] = [
    ...todayBatches,
    ...batches.filter((b: any) => !scheduledIds.has(b.id) && (sessionFor(b.id) || extraIds.includes(b.id))),
  ];
  const listedIds = new Set(listedBatches.map((b: any) => b.id));
  const otherBatches = batches.filter((b: any) => !listedIds.has(b.id));

  // ── Needs attention (real data only) ───────────────────────────────────────────
  const now = Date.now();
  const startOfToday = new Date(`${todayStr}T00:00:00+05:30`).getTime();
  const leadsToFollow = leads.filter((l) => {
    if (l.status === "ENROLLED" || l.status === "LOST") return false;
    if (l.status === "NEW") return true;
    return l.followUpDate ? new Date(l.followUpDate).getTime() <= now : false;
  });
  const upcomingTrials = trials
    .filter((t) => (t.status === "PENDING" || t.status === "CONFIRMED") && new Date(t.date).getTime() >= startOfToday)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextTrial = upcomingTrials[0];

  const attention: ReactNode[] = [];
  if (pendingVerification.length > 0) {
    attention.push(
      <AttentionItem
        key="verify"
        tone="info"
        title={`${pendingVerification.length} payment${pendingVerification.length === 1 ? "" : "s"} to confirm`}
        detail={`${pendingVerification.slice(0, 2).map((f) => f.student?.name).filter(Boolean).join(", ")} marked paid by parent`}
        onClick={() => onNavigate("fees")}
      />,
    );
  }
  if (overdue.length > 0) {
    attention.push(
      <AttentionItem
        key="overdue"
        tone="danger"
        title={`${overdue.length} overdue fee${overdue.length === 1 ? "" : "s"}`}
        detail={`${inr(overdueAmount)} from earlier months`}
        onClick={() => onNavigate("fees")}
      />,
    );
  }
  if (pendingThisMonth.length > 0) {
    attention.push(
      <AttentionItem
        key="pending"
        tone="warn"
        title={`${pendingThisMonth.length} fee${pendingThisMonth.length === 1 ? "" : "s"} pending this month`}
        detail={inr(pendingThisMonth.reduce((s, f) => s + (f.amount || 0), 0))}
        onClick={() => onNavigate("fees")}
      />,
    );
  }
  if (insights && insights.lowAttendanceCount > 0) {
    attention.push(
      <AttentionItem
        key="lowatt"
        tone="warn"
        title={`${insights.lowAttendanceCount} student${insights.lowAttendanceCount === 1 ? "" : "s"} below 60% attendance`}
        detail={`${insights.lowAttendance.slice(0, 3).map((s) => `${s.name} ${s.pct}%`).join(" · ")} (last 30 days)`}
        onClick={() => onNavigate("people")}
      />,
    );
  }
  if (leadsToFollow.length > 0) {
    attention.push(
      <AttentionItem
        key="leads"
        tone="info"
        title={`${leadsToFollow.length} lead${leadsToFollow.length === 1 ? "" : "s"} to follow up`}
        detail={leadsToFollow.slice(0, 3).map((l) => l.childName).filter(Boolean).join(", ")}
        onClick={() => onNavigate("leads")}
      />,
    );
  }
  if (nextTrial) {
    const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(new Date(nextTrial.date));
    attention.push(
      <AttentionItem
        key="trial"
        tone="info"
        title={`${upcomingTrials.length} upcoming trial${upcomingTrials.length === 1 ? "" : "s"}`}
        detail={`Next: ${nextTrial.childName}${nextTrial.batch?.name ? ` · ${nextTrial.batch.name}` : ""} · ${when}`}
        onClick={() => onNavigate("people")}
      />,
    );
  }

  const quick: { label: string; icon: ReactNode; tab: string }[] = [
    { label: "Add student", icon: <UserPlus className="w-4 h-4" />, tab: "people" },
    { label: "Collect fee", icon: <CreditCard className="w-4 h-4" />, tab: "fees" },
  ];
  if (FEATURES.bookings) quick.push({ label: "New booking", icon: <CalendarClock className="w-4 h-4" />, tab: "bookings" });

  return (
    <div className="space-y-7">
      {top}

      <div>
        <p className="text-xs text-zinc-500">{dateLabel}</p>
        <h2 className="mt-0.5 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50" suppressHydrationWarning>
          {greeting}{firstName ? "," : ""} {firstName && <span className="brand-text">{firstName}</span>}
        </h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <KpiTile
          label="Today's collection"
          value={inrCompact(collectedToday)}
          hint={paidToday.length > 0 ? `${paidToday.length} payment${paidToday.length === 1 ? "" : "s"}` : "No payments yet"}
          tone={collectedToday > 0 ? "brand" : "default"}
          onClick={() => onNavigate("fees")}
        />
        <KpiTile
          label="Pending dues"
          value={inrCompact(pendingDues)}
          hint={unpaid.length > 0 ? `${unpaid.length} fee${unpaid.length === 1 ? "" : "s"}` : "All settled"}
          tone={pendingDues > 0 ? "warn" : "default"}
          onClick={() => onNavigate("fees")}
        />
        <KpiTile
          label="Attendance today"
          value={attendancePct == null ? "—" : `${attendancePct}%`}
          hint={attendancePct == null ? "Not marked yet" : `${presentTotal}/${markedTotal} present`}
        />
      </div>

      {/* Quick actions */}
      <div className={`grid gap-2.5 ${quick.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {quick.map((q) => (
          <button key={q.label} type="button" onClick={() => onNavigate(q.tab)} className={`${shellButton.quiet} !px-2 text-[13px]`}>
            <span className="brand-text shrink-0">{q.icon}</span>
            <span className="truncate">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Needs attention */}
      <section>
        <SectionHeader title="Needs attention" />
        {attention.length > 0 ? (
          <div className="space-y-2">{attention}</div>
        ) : (
          <EmptyState
            compact
            icon={<CheckCircle2 className="w-5 h-5 brand-text" />}
            title="All clear"
            description="No overdue fees, follow-ups or low-attendance students right now."
          />
        )}
      </section>

      {/* Today's sessions — attendance is taken right here */}
      <section>
        <SectionHeader title="Today's sessions" description={!anyParsed && batches.length > 0 ? "Add days to a batch schedule (e.g. Mon/Wed 5 PM) to see only today's." : undefined} />
        {batches.length === 0 ? (
          <EmptyState
            compact
            icon={<Clock className="w-5 h-5" />}
            title="No batches yet"
            description="Create your first batch to start taking attendance."
            action={<button type="button" onClick={() => onNavigate("batches")} className={shellButton.primary}>Create a batch</button>}
          />
        ) : (
          <div className="space-y-2">
            {listedBatches.length === 0 && (
              <EmptyState compact icon={<Clock className="w-5 h-5" />} title="No sessions scheduled today" description="Running an extra or make-up session? Pick the batch below." />
            )}
            {listedBatches.map((b: any) => {
              const s = sessionFor(b.id);
              const marked = !!s && s.marked > 0;
              const enrolled = b.enrollments?.length || 0;
              const isExtra = !scheduledIds.has(b.id);
              return (
                <InlineAttendance
                  key={b.id}
                  batchId={b.id}
                  batchName={isExtra ? `${b.name} · extra session` : b.name}
                  subtitle={`${b.schedule || "No schedule"} · ${marked ? `${s!.present}/${s!.marked} present` : `${enrolled} student${enrolled === 1 ? "" : "s"}`}`}
                  marked={marked}
                  defaultOpen={extraIds.includes(b.id)}
                />
              );
            })}
            {otherBatches.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <ClipboardCheck className="w-4 h-4 text-zinc-500 shrink-0" />
                <select
                  aria-label="Take attendance for an extra session"
                  value=""
                  onChange={(e) => e.target.value && setExtraIds((ids) => [...ids, e.target.value])}
                  className="flex-1 h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-300"
                >
                  <option value="">Extra session? Take attendance for another batch…</option>
                  {otherBatches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}{b.schedule ? ` (${b.schedule})` : ""}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
