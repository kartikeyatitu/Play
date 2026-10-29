import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { FEATURES } from "@/lib/features";
import { logout } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { AdminClient, type AdminSecondaryData } from "@/components/org/AdminClient";

import { requireAuth } from "@/lib/auth";
import { coachesOfOrg, getMembership } from "@/lib/membership";
import { effectivePermissions } from "@/lib/team";
import { loadTodayPulse } from "@/lib/today";
import { resolveStudentFee, istMonthString, istToday, type FeeMonthStatus } from "@/lib/fees";
import { 
  getAttendanceAnalytics,
  getRevenueAnalytics,
  getBatchHealthAnalytics,
  getStudentGrowthAnalytics,
  getParentEngagementAnalytics 
} from "@/app/actions/analytics";
import { getLeads, getLeadStats } from "@/app/actions/leads";

import { publicOrg } from "@/lib/razorpay-org";

// Never send password hashes or third-party secret keys to the browser
const toClient = (v: unknown) =>
  JSON.parse(
    JSON.stringify(v, (k, val) =>
      k === "password" || k === "razorpayKeySecretEnc" || k === "razorpayWebhookSecretEnc" ? undefined : val
    )
  );

// Only the fields the dashboard UI reads from related users (no password / verification blobs)
const userBrief = { select: { id: true, name: true, phone: true } } as const;

/**
 * Real numbers for the Today screen, computed across the WHOLE academy (the students list on this
 * page is paginated, so it can't be used for these):
 *  - today's sessions (IST) with how many students were marked / present
 *  - active students whose attendance over the last 30 days is below 60% (min. 3 sessions marked)
 */
async function loadTodayInsights(orgId: string) {
  const todayStart = istToday();
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const since = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [sessionsToday, grouped] = await Promise.all([
    db.session.findMany({
      where: { batch: { orgId }, date: { gte: todayStart, lte: todayEnd } },
      select: { batchId: true, status: true, attendances: { select: { isPresent: true } } },
    }),
    db.attendance.groupBy({
      by: ["studentId", "isPresent"],
      where: { student: { orgId }, session: { batch: { orgId }, date: { gte: since, lt: todayStart }, status: { not: "CANCELLED" } } },
      _count: { _all: true },
    }),
  ]);

  const perStudent = new Map<string, { present: number; total: number }>();
  for (const g of grouped) {
    const e = perStudent.get(g.studentId) || { present: 0, total: 0 };
    e.total += g._count._all;
    if (g.isPresent) e.present += g._count._all;
    perStudent.set(g.studentId, e);
  }
  const low = [...perStudent.entries()]
    .filter(([, v]) => v.total >= 3 && v.present / v.total < 0.6)
    .map(([id, v]) => ({ id, pct: Math.round((v.present / v.total) * 100), sessions: v.total }))
    .sort((a, b) => a.pct - b.pct);
  const names = low.length
    ? await db.student.findMany({ where: { id: { in: low.slice(0, 50).map((l) => l.id) }, orgId }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(names.map((n) => [n.id, n.name]));

  return {
    todaySessions: sessionsToday.map((s) => ({
      batchId: s.batchId,
      status: s.status,
      marked: s.attendances.length,
      present: s.attendances.filter((a) => a.isPresent).length,
    })),
    lowAttendanceCount: low.length,
    lowAttendance: low
      .filter((l) => nameById.has(l.id))
      .slice(0, 5)
      .map((l) => ({ ...l, name: nameById.get(l.id) as string })),
  };
}

/**
 * Attendance for the students listed on this page (max 20), WITHOUT shipping each student's full
 * history (every attendance row they ever had, before). One query returns, per student:
 *  - the all-time present/total counts (window aggregates) → `attendanceSummary`, which is all the
 *    "Attendance Rate by Batch" chart needs;
 *  - only the rows the UI actually reads, in the same order as before (sessionId DESC):
 *    the newest 3 (At-Risk badge reads `slice(0, 3)` + `length >= 3`) and the oldest 10
 *    (ChurnPredictor reads `slice(-5)` / `slice(-10)`). With ≤ 13 rows this IS the full list; with
 *    more it has the same first 3 / last 10 entries, so both render exactly as before.
 * At most 13 rows per student come back instead of the entire history.
 */
type StudentAttendance = {
  attendances: { sessionId: string; isPresent: boolean }[];
  attendanceSummary: { present: number; total: number };
};
async function loadStudentAttendance(studentIds: string[]): Promise<Map<string, StudentAttendance>> {
  const byStudent = new Map<string, StudentAttendance>();
  if (studentIds.length === 0) return byStudent;
  // ORDER BY "sessionId" uses the same column collation Prisma's `orderBy: { sessionId: "desc" }` did.
  // Counts are cast to int: raw COUNT() is bigint, which JSON.stringify (toClient) cannot serialise.
  const rows = await db.$queryRaw<{ studentId: string; sessionId: string; isPresent: boolean; total: number; present: number }[]>`
    SELECT t."studentId", t."sessionId", t."isPresent", t."total", t."present"
    FROM (
      SELECT a."studentId", a."sessionId", a."isPresent",
        ROW_NUMBER() OVER (PARTITION BY a."studentId" ORDER BY a."sessionId" DESC) AS rn_desc,
        ROW_NUMBER() OVER (PARTITION BY a."studentId" ORDER BY a."sessionId" ASC) AS rn_asc,
        (COUNT(*) OVER (PARTITION BY a."studentId"))::int AS "total",
        (COUNT(*) FILTER (WHERE a."isPresent") OVER (PARTITION BY a."studentId"))::int AS "present"
      FROM "Attendance" a
      WHERE a."studentId" IN (${Prisma.join(studentIds)})
    ) t
    WHERE t.rn_desc <= 3 OR t.rn_asc <= 10
    ORDER BY t."studentId", t."sessionId" DESC`;
  for (const r of rows) {
    let e = byStudent.get(r.studentId);
    if (!e) {
      e = { attendances: [], attendanceSummary: { present: Number(r.present), total: Number(r.total) } };
      byStudent.set(r.studentId, e);
    }
    e.attendances.push({ sessionId: r.sessionId, isPresent: r.isPresent });
  }
  return byStudent;
}

/**
 * Data for tabs that are NOT visible on first paint (store, gallery, marketing, operations,
 * inbox, waitlist, fee plans/coupons, lead stats, AI insights). All queries start immediately
 * and run concurrently with the core queries, but the page does not wait for them: the promise
 * is streamed to the client and unwrapped with `use()` inside a <Suspense> when its tab opens.
 */
async function loadSecondaryData(orgId: string, access: { canSeeFees: boolean; canSeeReports: boolean }): Promise<AdminSecondaryData> {
  const { canSeeFees, canSeeReports } = access;
  const orgFilter = { orgId };
  const [
    products,
    orders,
    parents,
    messagesDesc,
    facilities,
    equipment,
    waitlist,
    coupons,
    galleryPhotos,
    transportRoutes,
    feePlans,
    testimonials,
    referrals,
    leadStats,
    attendanceData,
    revenueData,
    batchHealthData,
    studentGrowthData,
    parentEngagementData,
  ] = await Promise.all([
    db.product.findMany({ where: orgFilter, orderBy: { createdAt: "desc" } }),
    // StoreManager only renders PENDING orders
    db.order.findMany({
      where: { ...orgFilter, status: "PENDING" },
      include: {
        product: { select: { id: true, name: true, price: true } },
        student: { select: { id: true, name: true, parent: { select: { id: true, name: true, phone: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { role: "PARENT", ...orgFilter },
      select: { id: true, name: true, phone: true, email: true, role: true, orgId: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
    // Latest 500 messages (re-sorted ascending below) instead of the academy's entire history
    db.message.findMany({ where: orgFilter, orderBy: { createdAt: "desc" }, take: 500 }),
    db.facility.findMany({ where: orgFilter }),
    db.equipment.findMany({ where: orgFilter, include: { assignedTo: userBrief } }),
    db.waitlist.findMany({ where: orgFilter, include: { batch: { select: { id: true, name: true, sport: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    canSeeFees ? db.coupon.findMany({ where: orgFilter, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    db.galleryPhoto.findMany({ where: orgFilter, include: { uploadedBy: userBrief }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.transportRoute.findMany({ where: orgFilter, orderBy: { createdAt: "desc" } }),
    canSeeFees ? db.feePlan.findMany({ where: { isActive: true, ...orgFilter }, orderBy: { duration: "asc" } }) : Promise.resolve([]),
    db.feedback.findMany({ where: orgFilter, include: { parent: userBrief }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.referral.findMany({ where: { referrer: orgFilter }, include: { referrer: userBrief }, orderBy: { createdAt: "desc" }, take: 300 }),
    getLeadStats(orgId),
    // These scope to the caller's own academy internally (the argument is ignored).
    // Their only consumer is the "AI Insights" tab, which exists only when FEATURES.experimental
    // is on — so skip the work entirely otherwise (the tab can't be opened; nothing changes on screen).
    FEATURES.experimental && canSeeReports ? getAttendanceAnalytics(orgId) : null,
    FEATURES.experimental && canSeeReports ? getRevenueAnalytics(orgId) : null,
    FEATURES.experimental && canSeeReports ? getBatchHealthAnalytics(orgId) : null,
    FEATURES.experimental && canSeeReports ? getStudentGrowthAnalytics(orgId) : null,
    FEATURES.experimental && canSeeReports ? getParentEngagementAnalytics(orgId) : null,
  ]);

  return toClient({
    products,
    orders,
    parents,
    messages: messagesDesc.reverse(),
    facilities,
    equipment,
    waitlist,
    coupons,
    galleryPhotos,
    transportRoutes: transportRoutes.map((r: any) => ({ ...r, stops: JSON.parse(r.stops), studentNames: JSON.parse(r.studentNames) })),
    feePlans,
    testimonials,
    referrals,
    leadStats,
    analytics: {
      attendanceData,
      revenueData,
      batchHealthData,
      studentGrowthData,
      parentEngagementData,
    },
  });
}

export default async function AdminDashboard(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const session = await requireAuth(["ADMIN"]);
  if (!session.orgId) {
    redirect("/onboarding");
  }
  const orgId = session.orgId as string;
  const orgFilter = { orgId };
  // Match by student org too (older fee records may lack orgId)
  const orgFeeScope: Prisma.FeeRecordWhereInput = { OR: [orgFilter, { student: orgFilter }] };
  // Money and reports follow the person's permissions, not just the ADMIN app role (a manager may lack them).
  const myMembership = await getMembership(session.id, orgId);
  const myPerms = myMembership ? effectivePermissions(myMembership.role, myMembership.staffRole, myMembership.permissions) : null;
  const canSeeFees = !!myPerms?.has("fees.collect");
  const canSeeReports = !!myPerms?.has("reports.view");

  const currentMonth = istMonthString();

  const resolvedSearchParams = await props.searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const studentsPromise = db.student.findMany({
    where: orgFilter,
    skip: (page - 1) * 20,
    take: 20,
    include: {
      parent: { select: { id: true, name: true, phone: true, email: true } },
      enrollments: { include: { batch: { select: { id: true, name: true, sport: true, monthlyFee: true } } } },
      feeRecords: { where: { month: currentMonth } },
      // Attendance is no longer included here (it pulled each listed student's full history);
      // see loadStudentAttendance, which runs as soon as this page of students is known.
      // (skillReports were fetched here but never rendered on the org dashboard — removed)
    },
  });

  // Core data for the first paint — every independent query in ONE round of Promise.all.
  // Issued BEFORE the secondary queries so they get pooled connections first.
  const corePromise = Promise.all([
    db.student.count({ where: orgFilter }),
    db.student.count({ where: { ...orgFilter, createdAt: { gte: weekAgo } } }),
    studentsPromise,
    // Chained on the student page (needs its ids) but still overlaps the other core queries
    studentsPromise.then((rows) => loadStudentAttendance(rows.map((s) => s.id))),
    db.batch.findMany({
      where: orgFilter,
      // Sessions/attendances and enrolled student rows were fetched here but never read
      // from `batches` by the dashboard UI — only enrollment counts (`enrollments.length`)
      // are used, so ship just the ids (`.length` unchanged, the other columns dropped).
      include: { coach: userBrief, enrollments: { select: { id: true } } },
    }),
    db.user.findMany({
      where: coachesOfOrg(orgId),
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        verified: true,
        verificationData: true,
        orgId: true,
        createdAt: true,
        // This month's sessions (counted for "Sessions" / payout)
        // Only this academy's batches: a coach may also coach elsewhere
        batches: { where: { orgId }, include: { sessions: { where: { date: { gte: monthStart } }, select: { id: true, date: true } } } },
      },
    }),
    // All-time fee totals per (month, status) instead of every fee record ever (was unbounded:
    // students × months). At most months × statuses rows; every fee number on the dashboard
    // (KPIs, dues, overdue, sparkline, analytics charts) is derived from these buckets.
    canSeeFees
      ? db.feeRecord.groupBy({
          by: ["month", "status"],
          where: orgFeeScope,
          _count: { _all: true },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
    // "Today's collection" needs individual payments (filtered by IST day on the client):
    // only rows paid in the last 48h — a superset of "paid today in IST" — instead of all history.
    canSeeFees
      ? db.feeRecord.findMany({
          where: { AND: [orgFeeScope, { status: "PAID", paidAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } }] },
          select: { id: true, amount: true, status: true, paidAt: true },
        })
      : Promise.resolve([]),
    db.trialBooking.findMany({
      where: { batch: orgFilter },
      include: { batch: { select: { id: true, name: true, sport: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    // Payments parents reported via "I've paid" that the admin must confirm
    canSeeFees
      ? db.feeRecord.findMany({
          where: { status: "PENDING_VERIFICATION", student: { orgId } },
          include: { student: { select: { id: true, name: true, parent: { select: { name: true, phone: true } } } } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    db.organization.findUnique({ where: { id: orgId } }),
    getLeads(orgId),
  ]);

  // Kick off the secondary (non-overview) queries now, concurrently — but do NOT await them.
  const secondary = loadSecondaryData(orgId, { canSeeFees, canSeeReports });
  // Today-screen insights (attendance today / low attendance) run alongside the core queries; a
  // failure here must never take the dashboard down, so it degrades to "no insights".
  const insightsPromise = loadTodayInsights(orgId).catch(() => null);
  // Team check-ins, absent students and money pulse for the Today screen (same degrade-to-null rule)
  const pulsePromise = getMembership(session.id, orgId)
    .then((m) => loadTodayPulse(orgId, { canSeePay: !!m && effectivePermissions(m.role, m.staffRole, m.permissions).has("payroll.view") }))
    .catch((e) => {
      console.error("[triq] today pulse failed", e);
      return null;
    });
  // Mark as handled so an early rejection can't surface as an unhandledRejection before
  // React attaches its own handlers; React still receives (and reports) the error.
  secondary.catch(() => {});

  const [
    totalStudents,
    newStudentsThisWeek,
    studentRows,
    studentAttendance,
    batches,
    coaches,
    feeGroups,
    recentPaidFees,
    trialBookings,
    pendingVerification,
    org,
    leads,
  ] = await corePromise;
  const [baseInsights, pulse] = await Promise.all([insightsPromise, pulsePromise]);
  const insights = baseInsights ? { ...baseInsights, pulse } : null;

  // Same per-student shape the UI read before: `attendances` (sessionId DESC, bounded — see
  // loadStudentAttendance) plus `attendanceSummary` (all-time counts for the analytics chart).
  // Fee amounts and fee records only leave the server for people with fees.collect.
  const students = studentRows.map((s) => ({
    ...s,
    feeRecords: canSeeFees ? s.feeRecords : [],
    enrollments: s.enrollments.map((e) => ({ ...e, batch: { ...e.batch, monthlyFee: canSeeFees ? e.batch.monthlyFee : null } })),
    ...(studentAttendance.get(s.id) ?? { attendances: [], attendanceSummary: { present: 0, total: 0 } }),
  }));

  const feeSummary: FeeMonthStatus[] = feeGroups.map((g) => ({
    month: g.month,
    status: g.status,
    count: g._count._all,
    amount: g._sum.amount ?? 0,
  }));
  const countOf = (gs: FeeMonthStatus[]) => gs.reduce((n, g) => n + g.count, 0);
  const amountOf = (gs: FeeMonthStatus[]) => gs.reduce((s, g) => s + g.amount, 0);

  // Current month's fee records (all statuses), derived from the buckets instead of rows
  const currentMonthFees = feeSummary.filter((f) => f.month === currentMonth);
  const paidFeesCount = countOf(currentMonthFees.filter((f) => f.status === "PAID"));
  const totalFees = countOf(currentMonthFees);

  // ── Real trends (replace hard-coded "12% from last month", "+3 this week", fake sparkline) ──
  const monthKey = (offset: number) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    return d.toISOString().slice(0, 7);
  };
  const paidInMonth = (mk: string) => amountOf(feeSummary.filter((f) => f.month === mk && f.status === "PAID"));
  const revenueThisMonth = paidInMonth(currentMonth);
  const revenueLastMonth = paidInMonth(monthKey(-1));
  const revenueTrendPct = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : null;
  const revenueSparkline = [-5, -4, -3, -2, -1, 0].map((o) => paidInMonth(monthKey(o)));

  // Pending dues = sum of the actual unpaid fee amounts (all months)
  const unpaidFees = feeSummary.filter((f) => f.status !== "PAID");

  // Resolved monthly fee per student on this page (override → batch → academy default; 0 = not set)
  const studentFees: Record<string, number> = {};
  if (canSeeFees) for (const s of students) studentFees[s.id] = resolveStudentFee(s, org?.defaultMonthlyFee);
  // Typical fee across batches (for projections) — null when no fee is configured anywhere
  const configuredFees = batches.map((b) => b.monthlyFee).filter((f): f is number => !!f && f > 0);
  const typicalFee = !canSeeFees ? null : configuredFees.length
    ? configuredFees.sort((a, b) => a - b)[Math.floor(configuredFees.length / 2)]
    : org?.defaultMonthlyFee || null;

  const stats = {
    totalStudents,
    revenueThisMonth,
    pendingDues: amountOf(unpaidFees),
    paidFeesCount,
    feesCollectedRatio: totalFees > 0 ? `${paidFeesCount} / ${totalFees}` : "0 / 0",
    revenueTrendPct,
    revenueSparkline,
    newStudentsThisWeek,
    typicalFee,
    // Total billed for the current month (sum of this month's fee records)
    billedThisMonth: amountOf(currentMonthFees),
  };

  return (
    <AdminClient
      session={session}
      org={toClient(publicOrg(org))}
      students={toClient(students)}
      batches={toClient(batches.map((b) => ({ ...b, monthlyFee: canSeeFees ? b.monthlyFee : null })))}
      coaches={toClient(coaches)}
      feeSummary={feeSummary}
      recentPaidFees={toClient(recentPaidFees)}
      trials={toClient(trialBookings)}
      leads={toClient(leads)}
      secondary={secondary}
      currentMonth={currentMonth}
      stats={stats}
      studentFees={studentFees}
      pendingVerification={toClient(pendingVerification)}
      insights={insights}
      logoutAction={logout}
      currentPage={page}
      totalStudents={totalStudents}
    />
  );
}
