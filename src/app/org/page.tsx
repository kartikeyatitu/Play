import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { AdminClient, type AdminSecondaryData } from "@/components/org/AdminClient";

import { requireAuth } from "@/lib/auth";
import { coachesOfOrg } from "@/lib/membership";
import { resolveStudentFee, istMonthString, istToday } from "@/lib/fees";
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
 * Data for tabs that are NOT visible on first paint (store, gallery, marketing, operations,
 * inbox, waitlist, fee plans/coupons, lead stats, AI insights). All queries start immediately
 * and run concurrently with the core queries, but the page does not wait for them: the promise
 * is streamed to the client and unwrapped with `use()` inside a <Suspense> when its tab opens.
 */
async function loadSecondaryData(orgId: string): Promise<AdminSecondaryData> {
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
    db.coupon.findMany({ where: orgFilter, orderBy: { createdAt: "desc" } }),
    db.galleryPhoto.findMany({ where: orgFilter, include: { uploadedBy: userBrief }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.transportRoute.findMany({ where: orgFilter, orderBy: { createdAt: "desc" } }),
    db.feePlan.findMany({ where: { isActive: true, ...orgFilter }, orderBy: { duration: "asc" } }),
    db.feedback.findMany({ where: orgFilter, include: { parent: userBrief }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.referral.findMany({ where: { referrer: orgFilter }, include: { referrer: userBrief }, orderBy: { createdAt: "desc" }, take: 300 }),
    getLeadStats(orgId),
    // These scope to the caller's own academy internally (the argument is ignored)
    getAttendanceAnalytics(orgId),
    getRevenueAnalytics(orgId),
    getBatchHealthAnalytics(orgId),
    getStudentGrowthAnalytics(orgId),
    getParentEngagementAnalytics(orgId),
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

  const currentMonth = istMonthString();

  const resolvedSearchParams = await props.searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Core data for the first paint — every independent query in ONE round of Promise.all.
  // Issued BEFORE the secondary queries so they get pooled connections first.
  const corePromise = Promise.all([
    db.student.count({ where: orgFilter }),
    db.student.count({ where: { ...orgFilter, createdAt: { gte: weekAgo } } }),
    db.student.findMany({
      where: orgFilter,
      skip: (page - 1) * 20,
      take: 20,
      include: {
        parent: { select: { id: true, name: true, phone: true, email: true } },
        enrollments: { include: { batch: { select: { id: true, name: true, sport: true, monthlyFee: true } } } },
        feeRecords: { where: { month: currentMonth } },
        // Only the attendance fields the dashboard reads (at-risk badge, today's attendance,
        // churn predictor, attendance-by-batch chart)
        attendances: {
          select: { id: true, sessionId: true, isPresent: true, status: true, session: { select: { id: true, date: true, status: true } } },
          orderBy: { sessionId: "desc" },
        },
        // (skillReports were fetched here but never rendered on the org dashboard — removed)
      },
    }),
    db.batch.findMany({
      where: orgFilter,
      // Sessions/attendances and enrolled student rows were fetched here but never read
      // from `batches` by the dashboard UI — only enrollment counts are used.
      include: { coach: userBrief, enrollments: true },
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
    // Match by student org too (older fee records may lack orgId)
    db.feeRecord.findMany({
      where: { OR: [orgFilter, { student: orgFilter }] },
      select: { id: true, studentId: true, month: true, status: true, amount: true, paidAt: true },
    }),
    db.trialBooking.findMany({
      where: { batch: orgFilter },
      include: { batch: { select: { id: true, name: true, sport: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    // Payments parents reported via "I've paid" that the admin must confirm
    db.feeRecord.findMany({
      where: { status: "PENDING_VERIFICATION", student: { orgId } },
      include: { student: { select: { id: true, name: true, parent: { select: { name: true, phone: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.organization.findUnique({ where: { id: orgId } }),
    getLeads(orgId),
  ]);

  // Kick off the secondary (non-overview) queries now, concurrently — but do NOT await them.
  const secondary = loadSecondaryData(orgId);
  // Today-screen insights (attendance today / low attendance) run alongside the core queries; a
  // failure here must never take the dashboard down, so it degrades to "no insights".
  const insightsPromise = loadTodayInsights(orgId).catch(() => null);
  // Mark as handled so an early rejection can't surface as an unhandledRejection before
  // React attaches its own handlers; React still receives (and reports) the error.
  secondary.catch(() => {});

  const [
    totalStudents,
    newStudentsThisWeek,
    students,
    batches,
    coaches,
    allFeeRecords,
    trialBookings,
    pendingVerification,
    org,
    leads,
  ] = await corePromise;
  const insights = await insightsPromise;

  // Same filter as the old separate `currentMonthFees` query, derived instead of re-queried
  const currentMonthFees = allFeeRecords.filter((f) => f.month === currentMonth);
  const paidFeesCount = currentMonthFees.filter((f) => f.status === "PAID").length;
  const totalFees = currentMonthFees.length;

  // ── Real trends (replace hard-coded "12% from last month", "+3 this week", fake sparkline) ──
  const monthKey = (offset: number) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    return d.toISOString().slice(0, 7);
  };
  const paidInMonth = (mk: string) =>
    allFeeRecords.filter((f) => f.month === mk && f.status === "PAID").reduce((s, f) => s + (f.amount || 0), 0);
  const revenueThisMonth = paidInMonth(currentMonth);
  const revenueLastMonth = paidInMonth(monthKey(-1));
  const revenueTrendPct = revenueLastMonth > 0 ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100) : null;
  const revenueSparkline = [-5, -4, -3, -2, -1, 0].map((o) => paidInMonth(monthKey(o)));

  // Pending dues = sum of the actual unpaid fee amounts (all months)
  const unpaidFees = allFeeRecords.filter((f) => f.status !== "PAID");

  // Resolved monthly fee per student on this page (override → batch → academy default; 0 = not set)
  const studentFees: Record<string, number> = {};
  for (const s of students) studentFees[s.id] = resolveStudentFee(s, org?.defaultMonthlyFee);
  // Typical fee across batches (for projections) — null when no fee is configured anywhere
  const configuredFees = batches.map((b) => b.monthlyFee).filter((f): f is number => !!f && f > 0);
  const typicalFee = configuredFees.length
    ? configuredFees.sort((a, b) => a - b)[Math.floor(configuredFees.length / 2)]
    : org?.defaultMonthlyFee || null;

  const stats = {
    totalStudents,
    revenueThisMonth,
    pendingDues: unpaidFees.reduce((sum, f) => sum + (f.amount || 0), 0),
    paidFeesCount,
    feesCollectedRatio: totalFees > 0 ? `${paidFeesCount} / ${totalFees}` : "0 / 0",
    revenueTrendPct,
    revenueSparkline,
    newStudentsThisWeek,
    typicalFee,
    // Total billed for the current month (sum of this month's fee records)
    billedThisMonth: currentMonthFees.reduce((sum, f) => sum + (f.amount || 0), 0),
  };

  return (
    <AdminClient
      session={session}
      org={toClient(publicOrg(org))}
      students={toClient(students)}
      batches={toClient(batches)}
      coaches={toClient(coaches)}
      allFeeRecords={toClient(allFeeRecords)}
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
