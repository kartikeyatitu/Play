"use server";
// TRIQ Brand Studio (V9): scholarship / CSR programs and fee concessions. Gated by FEATURES.inclusive.
// Pure rules: src/lib/concessions.ts. Monthly fee generation applies active concessions.
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission, hasPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { canMoveProgram, rupeesToPaise } from "@/lib/brand-studio";
import { PROGRAM_KINDS, billedAmount, validateConcessionInput } from "@/lib/concessions";
import { resolveStudentFee } from "@/lib/fees";
import { orgCurrentMonth } from "@/lib/i18n";

const DISABLED = { success: false as const, error: "Scholarships are not enabled" };

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } }).catch(() => {});
}

export async function listScholarships() {
  if (!FEATURES.inclusive) return { ...DISABLED, data: null };
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error, data: null };
  const orgId = auth.session.orgId;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { defaultMonthlyFee: true, timezone: true } });
  const month = orgCurrentMonth(org);
  const [programs, concessions, students, sponsors] = await Promise.all([
    db.scholarshipProgram.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, include: { sponsor: { select: { name: true } } } }),
    db.feeConcession.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.student.findMany({
      where: { orgId },
      select: { id: true, name: true, feeOverride: true, enrollments: { select: { batch: { select: { monthlyFee: true } } } } },
      orderBy: { name: "asc" },
      take: 2000,
    }),
    FEATURES.sponsorship ? db.sponsorProfile.findMany({ where: { orgId, archivedAt: null }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  // "Foregone this month" from real fees and real concessions only.
  const byStudent = new Map<string, typeof concessions>();
  for (const c of concessions) byStudent.set(c.studentId, [...(byStudent.get(c.studentId) ?? []), c]);
  let foregone = 0;
  let studentsCovered = 0;
  for (const s of students) {
    const list = byStudent.get(s.id);
    if (!list) continue;
    const base = resolveStudentFee(s, org?.defaultMonthlyFee);
    const billed = billedAmount(base, list, month);
    if (billed !== base) {
      foregone += base - billed;
      studentsCovered++;
    }
  }
  return {
    success: true,
    data: {
      month,
      canApprove: hasPermission(auth.membership, "funding.approve"),
      programs,
      concessions: concessions.map((c) => ({ ...c, studentName: students.find((s) => s.id === c.studentId)?.name ?? "—" })),
      students: students.map((s) => ({ id: s.id, name: s.name })),
      sponsors,
      summary: { foregone, studentsCovered },
    },
  };
}

export async function saveScholarshipProgram(input: { name: string; kind: string; description?: string; monthlyBudget?: string | number; sponsorId?: string }) {
  if (!FEATURES.inclusive) return DISABLED;
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) return { success: false, error: "Program name is required (max 120 characters)" };
  if (!(PROGRAM_KINDS as readonly string[]).includes(input.kind)) return { success: false, error: "Choose a program type" };
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > 1000) return { success: false, error: "Description is too long" };
  let monthlyBudgetPaise: number | null = null;
  if (input.monthlyBudget !== undefined && input.monthlyBudget !== "") {
    const b = rupeesToPaise(input.monthlyBudget);
    if (!b.ok) return { success: false, error: b.error };
    monthlyBudgetPaise = b.value;
  }
  let sponsorId: string | null = null;
  if (input.sponsorId && FEATURES.sponsorship) {
    const sp = await db.sponsorProfile.findFirst({ where: { id: String(input.sponsorId), orgId: session.orgId }, select: { id: true } });
    if (!sp) return { success: false, error: "Sponsor not found" };
    sponsorId = sp.id;
  }
  const p = await db.scholarshipProgram.create({
    data: { orgId: session.orgId, name, kind: input.kind, description: description || null, monthlyBudgetPaise, sponsorId, createdById: session.id },
  });
  await db.sponsorshipStatusEvent.create({ data: { orgId: session.orgId, entityType: "PROGRAM", entityId: p.id, toStatus: "DRAFT", actorId: session.id } });
  await audit(session.id, session.orgId, "SCHOLARSHIP_PROGRAM_CREATED", { programId: p.id, kind: input.kind, monthlyBudgetPaise });
  revalidatePath("/org");
  return { success: true };
}

/** DRAFT → ACTIVE is the funding approval (funding.approve). Closing needs fees.manage. */
export async function setProgramStatus(id: string, to: string) {
  if (!FEATURES.inclusive) return DISABLED;
  const auth = await checkPermission(to === "ACTIVE" ? "funding.approve" : "fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const p = await db.scholarshipProgram.findFirst({ where: { id: String(id), orgId: session.orgId }, select: { id: true, status: true, monthlyBudgetPaise: true } });
  if (!p) return { success: false, error: "Program not found" };
  if (!canMoveProgram(p.status, to)) return { success: false, error: `Can't move a program from ${p.status} to ${to}` };
  const moved = await db.scholarshipProgram.updateMany({
    where: { id: p.id, orgId: session.orgId, status: p.status },
    data: { status: to, ...(to === "ACTIVE" ? { approvedById: session.id, approvedAt: new Date() } : {}) },
  });
  if (moved.count === 0) return { success: false, error: "Status changed; refresh and try again" };
  await db.sponsorshipStatusEvent.create({ data: { orgId: session.orgId, entityType: "PROGRAM", entityId: p.id, fromStatus: p.status, toStatus: to, actorId: session.id } });
  await audit(session.id, session.orgId, to === "ACTIVE" ? "SCHOLARSHIP_PROGRAM_APPROVED" : "SCHOLARSHIP_PROGRAM_STATUS", {
    programId: p.id,
    from: p.status,
    to,
    monthlyBudgetPaise: p.monthlyBudgetPaise,
  });
  revalidatePath("/org");
  return { success: true };
}

/** Grant a concession. It applies from the next fee generation; existing fee records are not changed. */
export async function grantConcession(input: Record<string, unknown>) {
  if (!FEATURES.inclusive) return DISABLED;
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const v = validateConcessionInput(input);
  if (!v.ok) return { success: false, error: v.error };
  const student = await db.student.findFirst({ where: { id: v.value.studentId, orgId: session.orgId }, select: { id: true } });
  if (!student) return { success: false, error: "Student not found" };
  if (v.value.programId) {
    const prog = await db.scholarshipProgram.findFirst({ where: { id: v.value.programId, orgId: session.orgId }, select: { status: true } });
    if (!prog) return { success: false, error: "Program not found" };
    if (prog.status !== "ACTIVE") return { success: false, error: "The program must be approved (active) before concessions can be granted under it" };
  }
  const c = await db.feeConcession.create({ data: { ...v.value, orgId: session.orgId, approvedById: session.id } });
  // Reason text is staff-only and deliberately kept out of the audit details.
  await audit(session.id, session.orgId, "FEE_CONCESSION_GRANTED", {
    concessionId: c.id,
    studentId: c.studentId,
    programId: c.programId,
    category: c.category,
    percentOff: c.percentOff,
    amountOff: c.amountOff,
    startMonth: c.startMonth,
    endMonth: c.endMonth,
  });
  revalidatePath("/org");
  return { success: true };
}

export async function revokeConcession(id: string) {
  if (!FEATURES.inclusive) return DISABLED;
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const { session } = auth;
  const r = await db.feeConcession.updateMany({
    where: { id: String(id), orgId: session.orgId, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: session.id },
  });
  if (r.count === 0) return { success: false, error: "Concession not found or already revoked" };
  await audit(session.id, session.orgId, "FEE_CONCESSION_REVOKED", { concessionId: id });
  revalidatePath("/org");
  return { success: true };
}
