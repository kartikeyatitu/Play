import type { CSSProperties } from "react";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CoachBatchRoster } from "@/components/coach/CoachBatchRoster";
import { SessionAttendanceCard, type TodaySession } from "@/components/coach/SessionAttendanceCard";
import { EmergencySOS, type SOSStudent } from "@/components/coach/EmergencySOS";
import { RSVPBadge, CreateMatchModal } from "@/components/coach/MatchManager";
import { CoachTabs, type CoachTab } from "@/components/coach/CoachTabs";
import { BatchBroadcast } from "@/components/coach/BatchBroadcast";
import { AcademySwitcher } from "@/components/team/AcademySwitcher";
import { CheckInCard } from "@/components/team/CheckInCard";
import { getMyAttendance } from "@/app/actions/team";
import { CoachMePanel } from "@/components/coach/CoachMePanel";
import { InviteParentsCard } from "@/components/coach/InviteParentsCard";
import { requireAuth } from "@/lib/auth";
import { istToday, istMonthString, istWeekday, scheduleRunsOn } from "@/lib/fees";
import { attendanceStatusOf, parseMedicalInfo, cleanPhone, scheduleTime, scheduleStartMinutes, firstName } from "@/lib/coach";
import { Calendar, Trophy, MapPin } from "lucide-react";
import { NeedsYou } from "@/components/coach/NeedsYou";
import { CoachAtRisk } from "@/components/coach/CoachAtRisk";
import { AttendanceSync } from "@/components/coach/AttendanceSync";
import { needsYou, planToday, scheduleRange, sessionPhase } from "@/lib/coach-today";
import { loadAtRiskStudents } from "@/lib/risk-data";

const TAB_IDS: CoachTab[] = ["today", "squad", "plan", "inbox", "me"];

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function CoachDashboard({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ADMINs may also use the coach view (owner-coaches taking attendance)
  const session = await requireAuth(["COACH", "ADMIN"]);
  const myAttendance = await getMyAttendance().catch(() => null);
  if (!session.orgId) redirect(session.role === "ADMIN" ? "/onboarding" : "/login");
  const orgId = session.orgId as string;
  const isAdmin = session.role === "ADMIN";

  const sp = (await searchParams) || {};
  const tabParam = typeof sp.tab === "string" ? (sp.tab as CoachTab) : "today";
  const initialTab: CoachTab = TAB_IDS.includes(tabParam) ? tabParam : "today";

  const currentMonth = istMonthString();
  const todayStart = istToday();
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const weekday = istWeekday();
  // Owners/managers may open the coach view. Default to the batches they coach themselves ("mine");
  // "all" shows every batch in the academy. Coaches always see only their own batches.
  const scopeParam = typeof sp.scope === "string" ? sp.scope : "";
  const ownBatchCount = isAdmin ? await db.batch.count({ where: { orgId, coachId: session.id } }) : 0;
  const scope: "mine" | "all" = !isAdmin ? "mine" : scopeParam === "all" ? "all" : scopeParam === "mine" ? "mine" : ownBatchCount > 0 ? "mine" : "all";
  const batchWhere = isAdmin && scope === "all" ? { orgId } : { coachId: session.id, orgId };
  const injuryWindow = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

  const [coach, batches, existingTodaySessions, events, org, currentMonthFeeRecords, trialsToday, recentInjuries] =
    await Promise.all([
      db.user.findUnique({ where: { id: session.id } }),
      db.batch.findMany({
        where: batchWhere,
        orderBy: { createdAt: "asc" },
        include: {
          enrollments: {
            orderBy: { student: { name: "asc" } },
            include: {
              student: {
                include: {
                  parent: {
                    select: {
                      id: true,
                      name: true,
                      phone: true,
                      lastSeenAt: true,
                    },
                  },
                  skillReports: { where: { month: currentMonth } },
                  attendances: { orderBy: { session: { date: "desc" } }, take: 5 },
                },
              },
            },
          },
        },
      }),
      db.session.findMany({
        where: { batch: batchWhere, date: { gte: todayStart, lte: todayEnd } },
        select: {
          id: true,
          batchId: true,
          status: true,
          cancelReason: true,
          recap: true,
          attendances: { select: { studentId: true, isPresent: true, status: true } },
        },
      }),
      db.event.findMany({
        where: { batch: batchWhere, date: { gte: new Date() } },
        include: { rsvps: true, batch: { select: { id: true, name: true } } },
        orderBy: { date: "asc" },
      }),
      db.organization.findUnique({
        where: { id: orgId },
        select: { name: true, upiId: true, defaultMonthlyFee: true, brandColor: true, hidePoweredBy: true },
      }),
      db.feeRecord.findMany({
        where: { orgId, month: currentMonth },
        select: { studentId: true, amount: true, status: true },
      }),
      db.trialBooking.findMany({
        where: { batch: batchWhere, date: { gte: todayStart, lte: todayEnd } },
        select: { id: true, batchId: true, childName: true, childAge: true, parentName: true, status: true },
        orderBy: { createdAt: "asc" },
      }),
      db.incident.findMany({
        where: { orgId, type: "INJURY", createdAt: { gte: injuryWindow }, student: { enrollments: { some: { batch: batchWhere } } } },
        select: { studentId: true, description: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  if (!coach) redirect("/login");

  const batchIds = batches.map((b) => b.id);
  const recentAnnouncements = await db.announcement.findMany({
    where: { orgId, batchId: { in: batchIds.length ? batchIds : ["__none__"] } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  // ---------- Lookups ----------
  const batchNameById = new Map(batches.map((b) => [b.id, b.name]));
  const feeByStudent = new Map(currentMonthFeeRecords.map((f) => [f.studentId, f]));
  const injuryByStudent = new Map<string, string>();
  for (const inc of recentInjuries) {
    if (!injuryByStudent.has(inc.studentId)) {
      const d = inc.description.split(".")[0].trim();
      injuryByStudent.set(inc.studentId, d.length > 40 ? `${d.slice(0, 40)}…` : d || "Recent injury");
    }
  }

  // ---------- Today ----------
  const sessionByBatch = new Map(existingTodaySessions.map((s) => [s.batchId, s]));
  const todaySessions: TodaySession[] = batches
    .filter((b) => sessionByBatch.has(b.id) || scheduleRunsOn(b.schedule, weekday) !== false)
    .map((b) => {
      const s = sessionByBatch.get(b.id);
      const attByStudent = new Map((s?.attendances || []).map((a) => [a.studentId, a]));
      return {
        key: s?.id || `pending-${b.id}`,
        batchId: b.id,
        batchName: b.name,
        sport: b.sport,
        time: scheduleTime(b.schedule) || b.schedule || null,
        status: (s?.status as TodaySession["status"]) || "PENDING",
        cancelReason: s?.cancelReason || null,
        recap: s?.recap || null,
        students: b.enrollments.map((e) => {
          const med = parseMedicalInfo(e.student.medicalInfo);
          return {
            id: e.student.id,
            name: e.student.name,
            status: attendanceStatusOf(attByStudent.get(e.student.id)),
            medical: med.severity === "alert" ? med.summary : null,
            medicalNote: med.severity === "info" ? med.summary : null,
            injury: injuryByStudent.get(e.student.id) || null,
            feeDue: feeByStudent.get(e.student.id)?.status === "PENDING",
            parentName: e.student.parent?.name ?? null,
            parentPhone: e.student.parent?.phone ?? null,
          };
        }),
        trials: trialsToday
          .filter((t) => t.batchId === b.id)
          .map((t) => ({ id: t.id, childName: t.childName, childAge: t.childAge, parentName: t.parentName, status: t.status })),
      };
    })
    .sort((a, b) => scheduleStartMinutes(batches.find((x) => x.id === a.batchId)?.schedule) - scheduleStartMinutes(batches.find((x) => x.id === b.batchId)?.schedule));

  const activeToday = todaySessions.filter((s) => s.status !== "CANCELLED");
  const todayTotal = activeToday.reduce((n, s) => n + s.students.length, 0);
  const todayIn = activeToday.reduce(
    (n, s) => n + s.students.filter((x) => x.status === "PRESENT" || x.status === "LATE").length,
    0
  );

  // ---------- Squad stats (unique students) ----------
  const uniqueStudents = new Map<string, (typeof batches)[0]["enrollments"][0]["student"]>();
  batches.forEach((b) => b.enrollments.forEach((e) => uniqueStudents.set(e.student.id, e.student)));
  const totalStudents = uniqueStudents.size;
  const totalEvaluated = Array.from(uniqueStudents.values()).filter((s) => s.skillReports.length > 0).length;
  const alertCount = new Set([
    ...Array.from(uniqueStudents.values()).filter((s) => parseMedicalInfo(s.medicalInfo).severity === "alert").map((s) => s.id),
    ...Array.from(injuryByStudent.keys()),
  ]).size;

  // ---------- Growth: parents who have never opened Triq ----------
  const seenParents = new Set<string>();
  const pendingParents = Array.from(uniqueStudents.values())
    .filter((s) => s.parent && s.parent.phone && !s.parent.lastSeenAt)
    .filter((s) => (seenParents.has(s.parent!.id) ? false : (seenParents.add(s.parent!.id), true)))
    .map((s) => ({ studentId: s.id, childName: s.name, parentName: s.parent?.name || "Parent" }));

  // ---------- SOS directory ----------
  const sosStudents: SOSStudent[] = Array.from(uniqueStudents.values()).map((s) => {
    const med = parseMedicalInfo(s.medicalInfo);
    const firstBatch = batches.find((b) => b.enrollments.some((e) => e.student.id === s.id));
    return {
      id: s.id,
      name: s.name,
      batchName: firstBatch?.name || "",
      bloodGroup: s.bloodGroup || null,
      medical: med.hasAny ? med.summary : null,
      parentName: s.parent?.name || "Parent",
      parentPhone: cleanPhone(med.emergencyContactPhone || s.parent?.phone),
    };
  });

  // ---------- Fees (Me tab) ----------
  const coachStudentsWithFees = batches.flatMap((b) =>
    b.enrollments.map((e) => {
      const s = e.student;
      const feeRec = feeByStudent.get(s.id);
      const amount = feeRec?.amount || s.feeOverride || b.monthlyFee || org?.defaultMonthlyFee || 0;
      return {
        studentId: s.id,
        studentName: s.name,
        parentName: s.parent?.name || "Parent",
        parentPhone: s.parent?.phone || "",
        batchName: b.name,
        monthlyFee: amount,
        feeStatus: (feeRec?.status === "PAID" ? "PAID" : "PENDING") as "PAID" | "PENDING",
        month: currentMonth,
      };
    })
  );

  const todayLabel = new Date().toLocaleDateString("en", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  // ---------- Panels ----------
  // ---------- Today: order by the clock, not by "first unfinished" ----------
  const istNow = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const part = (t: string) => Number(istNow.find((p) => p.type === t)?.value ?? 0);
  const nowMinutes = part("hour") * 60 + part("minute");
  const dayOfMonth = part("day");
  const scheduleByBatch = new Map(batches.map((b) => [b.id, b.schedule]));
  const phased = todaySessions.map((s) => {
    const range = scheduleRange(scheduleByBatch.get(s.batchId));
    const marked = s.students.filter((x) => x.status !== null).length;
    return { item: s, range, phase: sessionPhase({ cancelled: s.status === "CANCELLED", marked, total: s.students.length, range, nowMinutes }) };
  });
  const plan = planToday(phased);
  const heroLabel = plan.hero
    ? plan.hero.phase === "now"
      ? "Now"
      : plan.hero.phase === "in_progress"
        ? "In progress"
        : plan.hero.phase === "unmarked"
          ? "Not marked yet"
          : "Up next"
    : "Up next";
  const unmarkedCount = phased.filter((p) => p.phase === "unmarked").length;

  const atRisk = await loadAtRiskStudents(orgId, { canContact: true, batchIds }).catch(() => null);
  const scopeQuery = isAdmin ? `&scope=${scope}` : "";
  const needs = needsYou({
    unmarkedToday: unmarkedCount,
    evaluationsDue: Math.max(0, totalStudents - totalEvaluated),
    evaluationsTotal: totalStudents,
    dayOfMonth,
    atRiskHigh: atRisk?.high ?? 0,
    atRiskMedium: atRisk?.medium ?? 0,
    parentsNotOnApp: pendingParents.length,
    scopeQuery,
  });

  const shareContext = {
    coachName: coach.name,
    academyName: org?.name || "Academy",
    showPoweredBy: !org?.hidePoweredBy,
    dateLabel: todayLabel,
  };

  const sessionGroup = (id: string, title: string, items: typeof phased, missed = false) =>
    items.length > 0 ? (
      <section id={id} aria-labelledby={`${id}-title`} className="space-y-3 scroll-mt-20">
        <h3 id={`${id}-title`} className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {title} · {items.length}
        </h3>
        {items.map((p) => (
          <SessionAttendanceCard key={p.item.key} session={p.item} missed={missed} shareContext={shareContext} />
        ))}
      </section>
    ) : null;

  const scopeToggle = isAdmin ? (
    <nav aria-label="Which batches" className="inline-flex rounded-lg border border-line p-0.5 text-xs font-semibold">
      <a href={`/coach?tab=today&scope=mine`} aria-current={scope === "mine" ? "page" : undefined} className={`px-3 h-9 inline-flex items-center rounded-md ${scope === "mine" ? "bg-surface-2 text-ink" : "text-ink-muted"}`}>
        My batches{ownBatchCount === 0 ? " (0)" : ""}
      </a>
      <a href={`/coach?tab=today&scope=all`} aria-current={scope === "all" ? "page" : undefined} className={`px-3 h-9 inline-flex items-center rounded-md ${scope === "all" ? "bg-surface-2 text-ink" : "text-ink-muted"}`}>
        All batches
      </a>
    </nav>
  ) : null;

  const todayPanel = (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start space-y-5 lg:space-y-0">
      <div className="space-y-5 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-ink-subtle font-medium">{todayLabel}</p>
            <h2 className="text-2xl font-bold tracking-tight text-ink leading-tight">
              {greeting()}, <span style={{ color: "var(--brand)" }}>{firstName(coach.name)}</span>
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {activeToday.length === 0
                ? "No sessions today."
                : `${activeToday.length} session${activeToday.length === 1 ? "" : "s"} today · ${todayIn} of ${todayTotal} marked in`}
            </p>
          </div>
          {scopeToggle && <div className="sm:hidden">{scopeToggle}</div>}
        </div>

        <AttendanceSync />
        <AcademySwitcher className="w-full" />
        {myAttendance && (
          <div className="lg:hidden">
            <CheckInCard initial={myAttendance.today} subtle />
          </div>
        )}

        {todaySessions.length > 0 ? (
          <>
            {plan.hero && <SessionAttendanceCard key={plan.hero.item.key} session={plan.hero.item} isNextUp heroLabel={heroLabel} shareContext={shareContext} />}
            <div className="lg:hidden">
              <NeedsYou items={needs} />
            </div>
            {sessionGroup("not-marked", "Not marked yet", plan.unmarked, true)}
            {sessionGroup("later", "Later today", plan.upcoming)}
            {sessionGroup("done", "Done", plan.done)}
            {sessionGroup("cancelled", "Cancelled", plan.cancelled)}
          </>
        ) : (
          <>
            <div className="text-center py-12 bg-surface border border-line rounded-2xl p-6 space-y-2">
              <Calendar className="w-8 h-8 text-ink-subtle mx-auto" />
              <h3 className="text-base font-semibold text-ink">No sessions today ({weekday})</h3>
              <p className="text-ink-muted text-sm max-w-sm mx-auto">
                Rest day. Use Squad to finish this month&apos;s evaluations, or message a batch from Inbox.
              </p>
            </div>
            <div className="lg:hidden">
              <NeedsYou items={needs} />
            </div>
          </>
        )}

        <div id="invite-parents" className="scroll-mt-20 lg:hidden">
          <InviteParentsCard pending={pendingParents} academyName={org?.name || "our academy"} coachName={coach.name} />
        </div>
      </div>

      <aside className="hidden lg:block space-y-4 lg:sticky lg:top-20">
        <NeedsYou items={needs} />
        {myAttendance && <CheckInCard initial={myAttendance.today} subtle />}
        <div id="invite-parents-desktop">
          <InviteParentsCard pending={pendingParents} academyName={org?.name || "our academy"} coachName={coach.name} />
        </div>
      </aside>
    </div>
  );

  // Squad gets fee status merged in so the "Fee due" chip can work.
  const squadBatches = batches.map((b) => ({
    ...b,
    enrollments: b.enrollments.map((e) => ({
      ...e,
      student: { ...e.student, feeDue: feeByStudent.get(e.student.id)?.status === "PENDING" },
    })),
  }));
  // Cast: DB rows carry extra Prisma fields beyond BatchRecord's shape.
  const squadPanel = (
    <div className="space-y-6">
      {atRisk && atRisk.high + atRisk.medium + atRisk.low > 0 && (
        <div id="at-risk" className="scroll-mt-20">
          <CoachAtRisk data={atRisk} />
        </div>
      )}
      <CoachBatchRoster batches={squadBatches as unknown as import("@/components/coach/CoachBatchRoster").BatchRecord[]} coachId={coach.id} currentMonth={currentMonth} />
    </div>
  );

  const planPanel = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Matches &amp; events</h2>
          <p className="text-xs text-zinc-400">Fixtures and tournaments — parents RSVP in their app</p>
        </div>
        <CreateMatchModal batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
      </div>

      {events.length > 0 ? (
        <div className="grid gap-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-lime-400 shrink-0" />
                  <h3 className="font-bold text-white text-base truncate">{event.title}</h3>
                </div>
                <p className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
                  <Calendar className="w-3 h-3" />
                  {new Date(event.date).toLocaleString("en", {
                    timeZone: "Asia/Kolkata",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  <span className="text-zinc-600">·</span>
                  <MapPin className="w-3 h-3" />
                  {event.location || "Academy ground"}
                </p>
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                  {event.batch.name}
                </span>
              </div>
              <RSVPBadge rsvps={event.rsvps} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 space-y-2">
          <Trophy className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-zinc-200">No upcoming matches</h3>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto">
            Schedule a friendly or intra-academy match — parents get an RSVP request automatically.
          </p>
        </div>
      )}
    </div>
  );

  const inboxPanel = (
    <BatchBroadcast
      batches={batches.map((b) => ({ id: b.id, name: b.name, students: b.enrollments.length }))}
      recent={recentAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        kind: a.kind,
        batchName: (a.batchId && batchNameById.get(a.batchId)) || "",
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );

  const mePanel = (
    <CoachMePanel
      coach={{ id: coach.id, name: coach.name, phone: coach.phone, verified: coach.verified, verificationData: coach.verificationData }}
      isAdmin={isAdmin}
      orgName={org?.name || "the academy"}
      totalStudents={totalStudents}
      batches={batches.map((b) => ({ id: b.id, name: b.name, schedule: b.schedule }))}
      weekday={weekday}
      fees={{ students: coachStudentsWithFees, upiId: org?.upiId ?? null, currentMonth }}
    />
  );

  return (
    <div
      className="min-h-screen bg-canvas text-ink font-sans"
      style={org?.brandColor && /^#[0-9a-fA-F]{6}$/.test(org.brandColor) ? ({ "--brand": org.brandColor } as CSSProperties) : undefined}
    >
      {/* Sticky header with always-on SOS */}
      <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md border-b border-line">
        <div className="max-w-4xl lg:max-w-none mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg brand-bg flex items-center justify-center text-[15px] font-semibold shrink-0" aria-hidden>
              {(org?.name || "Triq").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink truncate leading-tight tracking-[-0.01em]">{org?.name || "Triq"}</div>
              <div className="text-[12px] text-ink-subtle leading-tight mt-0.5">Coach view</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <>
                <nav aria-label="Which batches" className="hidden sm:inline-flex rounded-lg border border-line p-0.5 text-xs font-semibold">
                  <a
                    href={`/coach?tab=${initialTab}&scope=mine`}
                    aria-current={scope === "mine" ? "page" : undefined}
                    className={`px-2.5 h-8 inline-flex items-center rounded-md ${scope === "mine" ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"}`}
                  >
                    My batches{ownBatchCount === 0 ? " (0)" : ""}
                  </a>
                  <a
                    href={`/coach?tab=${initialTab}&scope=all`}
                    aria-current={scope === "all" ? "page" : undefined}
                    className={`px-2.5 h-8 inline-flex items-center rounded-md ${scope === "all" ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"}`}
                  >
                    All batches
                  </a>
                </nav>
                <a href="/org" className="h-9 px-3 inline-flex items-center rounded-lg border border-line text-xs font-semibold text-ink-muted hover:text-ink">
                  Admin
                </a>
              </>
            )}
            <EmergencySOS students={sosStudents} coachId={coach.id} />
          </div>
        </div>
      </header>

      <div className="lg:pl-56">
      <main className="max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-28 lg:pb-12">
        <CoachTabs
          initialTab={initialTab}
          badges={{ today: activeToday.reduce((n, s) => n + s.trials.filter((t) => t.status === "PENDING" || t.status === "CONFIRMED").length, 0) || undefined }}
          panels={{ today: todayPanel, squad: squadPanel, plan: planPanel, inbox: inboxPanel, me: mePanel }}
        />
      </main>
      </div>
    </div>
  );
}
