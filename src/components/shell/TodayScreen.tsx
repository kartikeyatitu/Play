"use client";

import { useState, type ReactNode } from "react";
import { CreditCard, UserPlus, CalendarClock, CalendarDays, ClipboardCheck, MessageCircle, ChevronRight, Check } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { istDateString, scheduleRunsOn, istWeekday, type FeeMonthStatus } from "@/lib/fees";
import { KpiTile } from "@/components/shell/KpiTile";
import { AttentionItem } from "@/components/shell/AttentionItem";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { EmptyState, shellButton } from "@/components/shell/EmptyState";
import { CollectFeesBanner } from "@/components/org/CollectFees";
import { InlineAttendance } from "@/components/shell/InlineAttendance";
import type { TodayPulse } from "@/lib/today";
import { monthLabel } from "@/lib/payroll";
import { track } from "@/lib/analytics";
import { CountUp } from "@/components/ui/count-up";
import { Bar, Ring, rateTone } from "@/components/ui/meter";
import { sportKind } from "@/components/sport/sport-kind";

/** Server-computed, academy-wide numbers (see loadTodayInsights in src/app/org/page.tsx). */
export interface TodayInsights {
  todaySessions: { batchId: string; status: string; marked: number; present: number }[];
  lowAttendanceCount: number;
  lowAttendance: { id: string; name: string; pct: number; sessions: number }[];
  /** Team check-ins, absent students, unpaid salaries and month money (see src/lib/today.ts). */
  pulse?: TodayPulse | null;
}

export interface TodayScreenProps {
  ownerName?: string | null;
  batches: any[];
  /** All-time fee record counts/amounts per (month, status) (server groupBy, not raw rows) */
  feeSummary: FeeMonthStatus[];
  /** Fee records paid in the last 48h — filtered to "today (IST)" below */
  recentPaidFees: any[];
  pendingVerification: any[];
  leads: any[];
  trials: any[];
  insights: TodayInsights | null;
  currentMonth: string;
  pendingDues: number;
  onNavigate: (tab: string) => void;
  /** Rendered above the screen (e.g. the onboarding checklist for empty academies). */
  top?: ReactNode;
  /** Academy sport (org.sport); used for the small sport icon on session rows when a batch has none. */
  sport?: string | null;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
/** Compact only when a tile would overflow (≥ 1 lakh): ₹1.25L / ₹2.4Cr */
const inrCompact = (n: number) => {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2).replace(/\.?0+$/, "")}L`;
  return inr(n);
};

/** "Wednesday, 14 October" built from parts, so server (Node) and browser ICU always render the same text. */
function stableDate(d: Date, width: "long" | "short") {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: width, day: "numeric", month: width }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

/** wa.me link with a ready message; Indian 10-digit numbers get the 91 prefix. */
function whatsappLink(phone: string | null | undefined, text: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const to = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

function istParts(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now)) % 24;
  const dateLabel = stableDate(now, "long");
  return { hour, dateLabel };
}

export function TodayScreen({
  ownerName, batches, feeSummary, recentPaidFees, pendingVerification, leads, trials, insights, currentMonth, pendingDues, onNavigate, top, sport,
}: TodayScreenProps) {
  const { hour, dateLabel } = istParts();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (ownerName || "").trim().split(/\s+/)[0];

  // ── KPIs (real data only) ───────────────────────────────────────────────────────
  const todayStr = istDateString();
  const paidToday = recentPaidFees.filter((f) => f.status === "PAID" && f.paidAt && istDateString(new Date(f.paidAt)) === todayStr);
  const collectedToday = paidToday.reduce((s, f) => s + (f.amount || 0), 0);

  // Same filters as before, applied to the (month, status) buckets; counts/amounts are summed
  const countOf = (gs: FeeMonthStatus[]) => gs.reduce((n, g) => n + g.count, 0);
  const amountOf = (gs: FeeMonthStatus[]) => gs.reduce((s, g) => s + g.amount, 0);
  const unpaid = feeSummary.filter((f) => f.status !== "PAID");
  const unpaidCount = countOf(unpaid);
  const overdue = unpaid.filter((f) => f.status === "PENDING" && f.month < currentMonth);
  const overdueCount = countOf(overdue);
  const overdueAmount = amountOf(overdue);
  const pendingThisMonth = unpaid.filter((f) => f.status === "PENDING" && f.month === currentMonth);
  const pendingThisMonthCount = countOf(pendingThisMonth);
  // This month's fees: collected vs everything billed for the month
  const thisMonthFees = feeSummary.filter((f) => f.month === currentMonth);
  const monthBilled = amountOf(thisMonthFees);
  const monthPaid = amountOf(thisMonthFees.filter((f) => f.status === "PAID"));
  const monthPct = monthBilled > 0 ? Math.round((monthPaid / monthBilled) * 100) : null;
  const monthShort = monthLabel(currentMonth).split(" ")[0];

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
  if (overdueCount > 0) {
    attention.push(
      <AttentionItem
        key="overdue"
        tone="danger"
        title={`${overdueCount} overdue fee${overdueCount === 1 ? "" : "s"}`}
        detail={`${inr(overdueAmount)} from earlier months`}
        onClick={() => onNavigate("fees")}
      />,
    );
  }
  if (pendingThisMonthCount > 0) {
    attention.push(
      <AttentionItem
        key="pending"
        tone="warn"
        title={`${pendingThisMonthCount} fee${pendingThisMonthCount === 1 ? "" : "s"} pending this month`}
        detail={inr(amountOf(pendingThisMonth))}
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
    const when = stableDate(new Date(nextTrial.date), "short");
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

  const pulse = insights?.pulse ?? null;
  if (pulse?.payroll) {
    const n = pulse.payroll.unpaid.length;
    attention.push(
      <AttentionItem
        key="payroll"
        tone="warn"
        title={`${n} salar${n === 1 ? "y" : "ies"} for ${monthLabel(pulse.payroll.month)} not paid yet`}
        detail={pulse.payroll.unpaid.slice(0, 3).join(", ") + (n > 3 ? ` +${n - 3} more` : "")}
        onClick={() => onNavigate("payroll")}
      />,
    );
  }
  if (pulse?.team && pulse.team.notMarked.length > 0 && hour >= 10) {
    const n = pulse.team.notMarked.length;
    attention.push(
      <AttentionItem
        key="team"
        tone="info"
        title={`${n} team member${n === 1 ? "" : "s"} not checked in`}
        detail={pulse.team.notMarked.slice(0, 3).map((m) => m.name).join(", ") + (n > 3 ? ` +${n - 3} more` : "")}
        onClick={() => onNavigate("team")}
      />,
    );
  }

  const quick: { label: string; icon: ReactNode; tab: string }[] = [
    { label: "Add student", icon: <UserPlus className="w-4 h-4" />, tab: "people" },
    { label: "Collect fee", icon: <CreditCard className="w-4 h-4" />, tab: "fees" },
  ];
  if (FEATURES.bookings) quick.push({ label: "New booking", icon: <CalendarClock className="w-4 h-4" />, tab: "bookings" });

  const money = pulse?.money ?? null;
  const moneyOut = money ? money.expenses + money.salariesPaid : 0;
  const net = money ? money.collected - moneyOut : 0;
  const team = pulse?.team ?? null;

  return (
    <div className="space-y-8">
      {top}

      {/* Greeting + quick actions */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-subtle">{dateLabel}</p>
          <h2 className="mt-1 text-2xl sm:text-[32px] font-semibold leading-tight tracking-[-0.025em] text-ink" suppressHydrationWarning>
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h2>
        </div>
        <div className={`grid gap-2 sm:flex sm:shrink-0 ${quick.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => onNavigate(q.tab)}
              className={`${shellButton.quiet} !px-3 text-[13px] max-sm:flex-col max-sm:!gap-1 max-sm:py-2 max-sm:text-[12px]`}
            >
              <span className="text-ink-subtle shrink-0">{q.icon}</span>
              <span className="truncate">{q.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Prominent "Collect fees" banner — appears when the academy has unpaid fees */}
      {unpaidCount > 0 && (
        <CollectFeesBanner onNavigate={onNavigate} count={unpaidCount} amount={pendingDues} />
      )}

      {/* KPIs: one card, three cells */}
      <section aria-label="Today at a glance" className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface shadow-hairline overflow-hidden">
        <KpiTile
          label="Collected today"
          value={<CountUp value={collectedToday} format={inrCompact} />}
          hint={paidToday.length > 0 ? `${paidToday.length} payment${paidToday.length === 1 ? "" : "s"}` : "No payments yet"}
          onClick={() => onNavigate("fees")}
        />
        <KpiTile
          label="Pending dues"
          value={<CountUp value={pendingDues} format={inrCompact} />}
          meter={monthPct != null ? <Bar value={monthPct} tone="success" label={`${monthShort} fees ${monthPct}% collected`} /> : undefined}
          hint={
            monthPct != null
              ? `${monthShort}: ${monthPct}% collected`
              : unpaidCount > 0
                ? `${unpaidCount} fee${unpaidCount === 1 ? "" : "s"}`
                : "All settled"
          }
          onClick={() => onNavigate("fees")}
        />
        <KpiTile
          label="Attendance today"
          value={attendancePct == null ? "—" : <CountUp value={attendancePct} format={(n) => `${Math.round(n)}%`} />}
          aside={attendancePct != null ? <Ring value={attendancePct} tone={rateTone(attendancePct)} size={44} stroke={4} /> : undefined}
          meter={attendancePct != null ? <Bar value={attendancePct} tone={rateTone(attendancePct)} className="sm:hidden" /> : undefined}
          hint={attendancePct == null ? "Not marked yet" : `${presentTotal} of ${markedTotal} present`}
        />
      </section>

      {/* This month so far: P&L strip (owners/managers with payroll access) */}
      {money && (
        <button
          type="button"
          onClick={() => onNavigate("payroll")}
          className="group block w-full text-left rounded-xl border border-line bg-surface shadow-hairline transition-colors hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40"
        >
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4">
            <span className="text-[13px] font-medium text-ink-muted">This month so far</span>
            <span className="inline-flex items-center gap-1 text-[12px] text-ink-subtle group-hover:text-ink">
              Payroll <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 px-4 sm:px-5 pb-4 pt-3">
            <div className="min-w-0">
              <dt className="text-[12px] text-ink-subtle">Fees in</dt>
              <dd className="num mt-1 text-base sm:text-lg font-semibold text-ink truncate">{inrCompact(money.collected)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-ink-subtle">Salaries</dt>
              <dd className="num mt-1 text-base sm:text-lg font-semibold text-ink truncate">−{inrCompact(money.salariesPaid)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-ink-subtle">Expenses</dt>
              <dd className="num mt-1 text-base sm:text-lg font-semibold text-ink truncate">−{inrCompact(money.expenses)}</dd>
            </div>
            <div className="min-w-0 sm:border-l sm:border-line sm:pl-4">
              <dt className="text-[12px] text-ink-subtle">Net</dt>
              <dd className={`num mt-1 text-base sm:text-lg font-semibold truncate ${net >= 0 ? "text-success" : "text-danger"}`}>
                {net >= 0 ? "+" : "−"}<CountUp value={Math.abs(net)} format={inrCompact} />
              </dd>
            </div>
          </dl>
        </button>
      )}

      {/* Team today */}
      {team && (
        <button
          type="button"
          onClick={() => onNavigate("team")}
          className="group w-full flex items-center justify-between gap-4 rounded-xl border border-line bg-surface shadow-hairline px-4 sm:px-5 py-3.5 text-left transition-colors hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40"
        >
          <span className="min-w-0 text-sm text-ink-muted">
            Team: <span className="num font-semibold text-ink">{team.checkedIn}/{team.total}</span> checked in
            {team.onLeave > 0 && <span className="text-ink-subtle"> · {team.onLeave} on leave</span>}
          </span>
          <span className="flex items-center gap-3 shrink-0">
            {team.total > 0 && team.total <= 24 && (
              <span className="hidden sm:flex items-center gap-0.5" aria-hidden>
                {Array.from({ length: team.total }).map((_, i) => (
                  <span key={i} className={`h-3 w-1.5 rounded-[2px] ${i < team.checkedIn ? "bg-success" : "bg-zinc-800"}`} />
                ))}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-ink-muted" aria-hidden />
          </span>
        </button>
      )}

      {/* Needs attention */}
      <section>
        <SectionHeader title="Needs attention" />
        {attention.length > 0 ? (
          <div className="divide-y divide-line rounded-xl border border-line bg-surface shadow-hairline overflow-hidden">
            {attention.map((node, i) => (
              <div key={i}>{node}</div>
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            icon={<Check className="text-success" />}
            title="All clear"
            description="No overdue fees, follow-ups or low-attendance students right now."
          />
        )}
      </section>

      {/* Absent today: one-tap WhatsApp check-in with the parent */}
      {pulse && pulse.absentToday.length > 0 && (
        <section>
          <SectionHeader title={`Absent today (${pulse.absentToday.length})`} description="A short message from the academy brings children back." />
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-hairline">
            {pulse.absentToday.slice(0, 8).map((a) => {
              const firstChild = a.name.split(" ")[0];
              const parent = (a.parentName || "").split(" ")[0];
              const link = whatsappLink(
                a.parentPhone,
                `Hi${parent ? ` ${parent}` : ""}, we missed ${firstChild} at today's ${a.batchName} session${pulse.academyName ? ` at ${pulse.academyName}` : ""}. Hope all is well! Let us know if ${firstChild} would like a make-up session.`
              );
              return (
                <li key={a.studentId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-danger shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{a.name}</div>
                      <div className="text-[13px] text-ink-subtle truncate">{a.batchName}</div>
                    </div>
                  </div>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Message ${a.name}'s parent on WhatsApp`}
                      onClick={() => track("parent_whatsapp_clicked", { surface: "today_absent" })}
                      className="press shrink-0 h-9 px-3 rounded-lg border border-line bg-surface text-[13px] font-medium text-ink hover:bg-surface-2 hover:border-zinc-700 inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-ink-subtle" /> Message parent
                    </a>
                  ) : (
                    <span className="text-[13px] text-ink-subtle">No phone</span>
                  )}
                </li>
              );
            })}
          </ul>
          {pulse.absentToday.length > 8 && <p className="mt-2 text-[13px] text-ink-subtle">+{pulse.absentToday.length - 8} more absent today</p>}
        </section>
      )}

      {/* Today's sessions — attendance is taken right here */}
      <section>
        <SectionHeader title="Today's sessions" description={!anyParsed && batches.length > 0 ? "Add days to a batch schedule (e.g. Mon/Wed 5 PM) to see only today's." : undefined} />
        {batches.length === 0 ? (
          <EmptyState
            icon={<CalendarDays />}
            title="No batches yet"
            description="Create your first batch to start taking attendance."
            action={<button type="button" onClick={() => onNavigate("batches")} className={shellButton.primary}>Create a batch</button>}
          />
        ) : (
          <div className="space-y-2">
            {listedBatches.length === 0 && (
              <EmptyState compact icon={<CalendarDays />} title="No sessions scheduled today" description="Running an extra or make-up session? Pick the batch below." />
            )}
            {listedBatches.map((b: any) => {
              const s = sessionFor(b.id);
              const marked = !!s && s.marked > 0;
              const enrolled = b.enrollments?.length || 0;
              const isExtra = !scheduledIds.has(b.id);
              return (
                <InlineAttendance
                  key={b.id}
                  sport={sportKind(b.sport || sport)}
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
                <ClipboardCheck className="w-4 h-4 text-ink-subtle shrink-0" />
                <select
                  aria-label="Take attendance for an extra session"
                  value=""
                  onChange={(e) => e.target.value && setExtraIds((ids) => [...ids, e.target.value])}
                  className="flex-1 h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink-muted"
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
