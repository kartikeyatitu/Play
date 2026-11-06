import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { logout } from '@/app/actions/auth';
import { ParentClient } from '@/components/parent/ParentClient';
import { istMonthString } from '@/lib/fees';

import { requireAuth } from '@/lib/auth';
import { coachesOfOrg } from '@/lib/membership';
import {
  homeFeeStatus,
  latestProgressNote,
  nextSession,
  privateLeaderboard,
  weekAttendance,
  weekRange,
} from '@/components/parent/home-summary';

/** Keep only step names + statuses of a coach's verification JSON (drops uploaded document URLs). */
function publicVerificationSummary(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { steps?: { name?: string; status?: string }[] };
    const steps = Array.isArray(parsed?.steps) ? parsed.steps.map((s) => ({ name: s?.name, status: s?.status })) : [];
    return JSON.stringify({ steps });
  } catch {
    return null;
  }
}

export default async function ParentPage() {
  const session = await requireAuth(["PARENT"]);
  // Strict tenant filter: a parent without an academy sees nothing tenant-wide
  // (previously fell back to {} which exposed every academy's data).
  const orgId: string = session.orgId || "__no_org__";
  const orgFilter = { orgId };

  const currentMonth = istMonthString();

  // Round 1 — everything that only depends on the session, in parallel.
  // (Previously ~10 sequential round trips; `parent.id` is always `session.id`.)
  const [parent, childrenRaw, products, leaderboard, admin, coaches, existingFeedback, batches, org] = await Promise.all([
    db.user.findUnique({
      where: { id: session.id },
    }),
    db.student.findMany({
      where: { parentId: session.id, ...orgFilter },
      include: {
        enrollments: { include: { batch: true } },
        feeRecords: { where: { month: currentMonth } },
        attendances: { orderBy: { session: { date: 'desc' } }, take: 10, include: { session: true } },
        skillReports: { orderBy: { createdAt: 'desc' } },
        RSVP: { include: { event: true } },
        Media: { orderBy: { createdAt: 'desc' } },
      },
    }),
    db.product.findMany({ where: orgFilter }),
    db.student.findMany({
      where: orgFilter,
      orderBy: { points: 'desc' },
      take: 10,
      select: { id: true, name: true, points: true },
    }),
    db.user.findFirst({ where: { role: 'ADMIN', ...orgFilter }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { verified: true, ...coachesOfOrg(orgId) },
      include: {
        batches: { where: { orgId }, select: { sport: true } }
      }
    }),
    db.feedback.findFirst({
      where: { parentId: session.id },
    }),
    // Only used for the "enroll another child" batch picker
    db.batch.findMany({
      where: orgFilter,
      select: { id: true, name: true, sport: true, schedule: true, monthlyFee: true },
    }),
    session.orgId
      ? db.organization.findUnique({ where: { id: session.orgId }, select: { id: true, name: true, upiId: true, timezone: true } })
      : Promise.resolve(null),
  ]);

  if (!parent) {
    redirect('/');
  }

  // Round 2 — queries that depend on round-1 results, again in parallel.
  const now = new Date();
  const childBatchIds = Array.from(new Set(childrenRaw.flatMap((c) => c.enrollments.map((e) => e.batchId))));

  const [children, chatMessagesDesc, announcements] = await Promise.all([
    // Per-child data: unpaid fees across months + real attendance %
    Promise.all(
      childrenRaw.map(async (child) => {
        const batchIds = child.enrollments.map((e) => e.batchId);
        const firstJoined = child.enrollments.reduce<Date | null>(
          (min, e) => (!min || e.joinedAt < min ? e.joinedAt : min),
          null
        );
        const [totalSessions, presentCount, dueFees] = await Promise.all([
          // Sessions held for the child's batches since they joined (excluding cancelled / future)
          batchIds.length
            ? db.session.count({
                where: {
                  batchId: { in: batchIds },
                  status: { not: 'CANCELLED' },
                  date: { lte: now, ...(firstJoined ? { gte: new Date(firstJoined.toISOString().slice(0, 10) + 'T00:00:00.000Z') } : {}) },
                },
              })
            : Promise.resolve(0),
          db.attendance.count({
            where: { studentId: child.id, isPresent: true, session: { batchId: { in: batchIds }, status: { not: 'CANCELLED' } } },
          }),
          db.feeRecord.findMany({
            where: { studentId: child.id, status: { in: ['PENDING', 'PENDING_VERIFICATION'] } },
            orderBy: { month: 'desc' },
          }),
        ]);
        const attendancePct = totalSessions > 0 ? Math.min(100, Math.round((presentCount / totalSessions) * 100)) : null;
        return {
          ...child,
          dueFees,
          attendanceSummary: { totalSessions, presentCount, pct: attendancePct },
        };
      })
    ),
    // Latest 300 messages of the thread (re-sorted ascending below) instead of the full history
    admin
      ? db.message.findMany({
          where: {
            OR: [
              { senderId: parent.id, receiverId: admin.id },
              { senderId: admin.id, receiverId: parent.id }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: 300,
        })
      : Promise.resolve([]),
    db.announcement.findMany({
      where: { ...orgFilter, OR: [{ batchId: null }, { batchId: { in: childBatchIds } }] },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);
  const chatMessages = chatMessagesDesc.reverse();

  // Round 3 — top card per child: next session, this week's attendance, fee status, latest note.
  // Everything is scoped to this parent's own children (childrenRaw is filtered by parentId).
  const tz = org?.timezone || 'Asia/Kolkata';
  const week = weekRange(now, tz);
  const childIds = childrenRaw.map((c) => c.id);
  const horizonEnd = new Date(Date.parse(`${week.today}T00:00:00.000Z`) + 15 * 86_400_000);
  const [cardSessions, presentRows, latestReceipts] = await Promise.all([
    childBatchIds.length
      ? db.session.findMany({
          where: { batchId: { in: childBatchIds }, date: { gte: new Date(`${week.start}T00:00:00.000Z`), lte: horizonEnd } },
          select: { id: true, batchId: true, date: true, status: true },
        })
      : Promise.resolve([]),
    childIds.length && childBatchIds.length
      ? db.attendance.findMany({
          where: {
            studentId: { in: childIds },
            isPresent: true,
            session: { batchId: { in: childBatchIds }, date: { gte: new Date(`${week.start}T00:00:00.000Z`) } },
          },
          select: { studentId: true, sessionId: true },
        })
      : Promise.resolve([]),
    Promise.all(
      childIds.map((id) =>
        db.receipt.findFirst({ where: { studentId: id, orgId }, orderBy: { issuedAt: 'desc' }, select: { studentId: true, token: true } })
      )
    ),
  ]);
  const homeCards = children.map((child) => {
    const batchIds = new Set(child.enrollments.map((e) => e.batchId));
    const sessionsForChild = cardSessions.filter((s) => batchIds.has(s.batchId));
    const present = presentRows.filter((a) => a.studentId === child.id).map((a) => a.sessionId);
    return {
      id: child.id,
      name: child.name,
      batchName: child.enrollments[0]?.batch?.name ?? null,
      nextSession: nextSession(
        child.enrollments.map((e) => ({ id: e.batchId, name: e.batch.name, schedule: e.batch.schedule })),
        sessionsForChild,
        now,
        tz
      ),
      week: weekAttendance(sessionsForChild, present, now, tz),
      fee: homeFeeStatus(child.dueFees, now, tz),
      latestReceiptToken: latestReceipts.find((r) => r?.studentId === child.id)?.token ?? null,
      note: latestProgressNote(child.skillReports),
    };
  });

  // Kept for components that still take a single number: sum of the children's real session counts
  const totalSessions = children.reduce((sum, c) => sum + c.attendanceSummary.totalSessions, 0);

  return (
    <ParentClient
      session={JSON.parse(JSON.stringify(session))}
      parent={JSON.parse(JSON.stringify({ ...parent, password: undefined }))}
      children={JSON.parse(JSON.stringify(children))}
      products={JSON.parse(JSON.stringify(products))}
      // Other families' children are never named to a parent (rank and points only).
      leaderboard={privateLeaderboard(leaderboard, childrenRaw.map((c) => c.id))}
      homeCards={JSON.parse(JSON.stringify(homeCards))}
      today={week.today}
      chatMessages={JSON.parse(JSON.stringify(chatMessages))}
      announcements={JSON.parse(JSON.stringify(announcements))}
      totalSessions={totalSessions}
      existingFeedback={JSON.parse(JSON.stringify(existingFeedback))}
      admin={JSON.parse(JSON.stringify(admin ? { id: admin.id, name: admin.name } : null))}
      coaches={JSON.parse(JSON.stringify(coaches.map((c) => ({
        // Parents only need the public-safe summary: never phone/email/ID-proof upload URLs.
        id: c.id,
        name: c.name,
        verified: c.verified,
        batches: c.batches,
        verificationData: publicVerificationSummary(c.verificationData),
      }))))}
      batches={JSON.parse(JSON.stringify(batches))}
      currentMonth={currentMonth}
      org={JSON.parse(JSON.stringify(org))}
      logoutAction={logout}
    />
  );
}
