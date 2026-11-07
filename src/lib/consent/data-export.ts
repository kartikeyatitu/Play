// Server-only: the JSON a guardian receives for "Download my child's data" (DataRequest type EXPORT).
// Existing tables only, tier 1 data the guardian is entitled to (TRIQ_DATA_PRIVACY.md section 3).
// Left out on purpose: other children's and other adults' personal data (coach phones, other parents),
// receipt share tokens, internal ids of other people, and anything from tiers 2 and 3 (not collected).
// Wave 2 tables are included only when their flag is on.
// COUNSEL: confirm the scope of a guardian's access/portability right under DPDP (and whether coach
// incident notes must be included or may be withheld), and the export format.
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";

export const CHILD_EXPORT_FORMAT = "triq.child-export.v1";

export async function buildChildExport(studentId: string, requestedBy: { userId: string; referenceId: string }) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      dob: true,
      bloodGroup: true,
      medicalInfo: true,
      createdAt: true,
      org: { select: { name: true, city: true } },
      enrollments: { select: { joinedAt: true, batch: { select: { name: true, sport: true, schedule: true } } } },
      attendances: {
        select: { status: true, isPresent: true, notes: true, session: { select: { date: true, status: true, batch: { select: { name: true } } } } },
      },
      skillReports: {
        select: { month: true, sport: true, technique: true, fitness: true, discipline: true, metrics: true, notes: true, createdAt: true, coach: { select: { name: true } } },
        orderBy: { month: "asc" },
      },
      feeRecords: { select: { month: true, amount: true, status: true, paymentMethod: true, paidAt: true }, orderBy: { month: "asc" } },
      receipts: { select: { receiptNumber: true, month: true, amount: true, paymentMode: true, issuedAt: true, batchName: true } },
      incidents: { select: { type: true, severity: true, description: true, createdAt: true } },
      RSVP: { select: { status: true, event: { select: { title: true, date: true, location: true } } } },
    },
  });
  if (!student) return null;

  const [guardianLinks, consents, waiverSignatures] = await Promise.all([
    FEATURES.familyAccounts
      ? db.guardianLink.findMany({ where: { studentId }, select: { relation: true, isPrimary: true, verifiedAt: true, createdAt: true } })
      : Promise.resolve(null),
    FEATURES.consentLedger
      ? db.consentRecord.findMany({
          where: { studentId },
          select: { purpose: true, granted: true, grantedAt: true, withdrawnAt: true, method: true, noticeVersion: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve(null),
    FEATURES.waivers
      ? db.waiverSignature.findMany({
          where: { studentId },
          // ipHash is left out: it is evidence for the academy, not personal data the guardian needs.
          select: { version: true, signedName: true, signedAt: true, template: { select: { title: true } } },
          orderBy: { signedAt: "asc" },
        })
      : Promise.resolve(null),
  ]);

  const attendance = [...student.attendances]
    .sort((a, b) => a.session.date.getTime() - b.session.date.getTime())
    .map((a) => ({
      date: a.session.date,
      batch: a.session.batch.name,
      sessionStatus: a.session.status,
      status: a.status ?? (a.isPresent ? "PRESENT" : "ABSENT"),
      notes: a.notes,
    }));

  return {
    format: CHILD_EXPORT_FORMAT,
    generatedAt: new Date().toISOString(),
    referenceId: requestedBy.referenceId,
    child: {
      name: student.name,
      dateOfBirth: student.dob,
      bloodGroup: student.bloodGroup,
      medicalInfo: student.medicalInfo,
      addedOn: student.createdAt,
      academy: student.org ? { name: student.org.name, city: student.org.city } : null,
    },
    batches: student.enrollments.map((e) => ({ name: e.batch.name, sport: e.batch.sport, schedule: e.batch.schedule, joinedAt: e.joinedAt })),
    attendance,
    progressReports: student.skillReports.map((r) => ({
      month: r.month,
      sport: r.sport,
      technique: r.technique,
      fitness: r.fitness,
      discipline: r.discipline,
      metrics: r.metrics,
      notes: r.notes,
      coach: r.coach.name,
      createdAt: r.createdAt,
    })),
    fees: student.feeRecords,
    receipts: student.receipts,
    incidents: student.incidents,
    events: student.RSVP.map((r) => ({ title: r.event.title, date: r.event.date, location: r.event.location, response: r.status })),
    ...(guardianLinks ? { guardians: guardianLinks } : {}),
    ...(consents ? { consents } : {}),
    ...(waiverSignatures
      ? { waivers: waiverSignatures.map((w) => ({ title: w.template.title, version: w.version, signedName: w.signedName, signedAt: w.signedAt })) }
      : {}),
  };
}
