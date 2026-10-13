import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { logout } from '@/app/actions/auth';
import { ParentClient } from '@/components/parent/ParentClient';
import { istMonthString } from '@/lib/fees';

import { requireAuth } from '@/lib/auth';

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
      where: { role: 'COACH', verified: true, ...orgFilter },
      include: {
        batches: { select: { sport: true } }
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
      ? db.organization.findUnique({ where: { id: session.orgId }, select: { id: true, name: true, upiId: true } })
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

  // Kept for components that still take a single number: sum of the children's real session counts
  const totalSessions = children.reduce((sum, c) => sum + c.attendanceSummary.totalSessions, 0);

  return (
    <ParentClient
      session={JSON.parse(JSON.stringify(session))}
      parent={JSON.parse(JSON.stringify({ ...parent, password: undefined }))}
      children={JSON.parse(JSON.stringify(children))}
      products={JSON.parse(JSON.stringify(products))}
      leaderboard={JSON.parse(JSON.stringify(leaderboard))}
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
