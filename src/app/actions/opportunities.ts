"use server";

// V2 TRIQ Athlete: academy-owned trials / scholarships board with guardian-consented applications
// and an append-only status history. Gated by FEATURES.opportunities (off by default).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { checkPermission } from "@/lib/membership";
import { orgToday } from "@/lib/i18n";
import { isMissingTableError, SCHEMA_PENDING_MESSAGE } from "@/lib/schema-pending";
import {
  canChangeOpportunityStatus,
  canTransitionApplication,
  checkEligibility,
  isOpportunityStatus,
  parseOpportunityInput,
} from "@/lib/opportunities";

type Fail = { success: false; error: string };
const NOT_ENABLED: Fail = { success: false, error: "Not enabled" };

function failFrom(e: unknown): Fail {
  if (isMissingTableError(e)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
  throw e;
}

async function orgDay(orgId: string): Promise<Date> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  return new Date(`${orgToday(org)}T00:00:00.000Z`);
}

async function staff() {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return null;
  return { userId: auth.session.id as string, orgId: auth.session.orgId };
}

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
}

function refresh() {
  revalidatePath("/org");
  revalidatePath("/parent");
}

// ── Staff ──────────────────────────────────────────────────────────────────────

export async function listOpportunitiesAdmin() {
  if (!FEATURES.opportunities) return NOT_ENABLED;
  const s = await staff();
  if (!s) return { success: false as const, error: "You don't have permission to do this" };
  try {
    const [opportunities, batches, counts] = await Promise.all([
      db.opportunity.findMany({ where: { orgId: s.orgId }, orderBy: [{ status: "asc" }, { applyBy: "asc" }] }),
      db.batch.findMany({ where: { orgId: s.orgId }, select: { id: true, name: true, sport: true }, orderBy: { name: "asc" } }),
      db.opportunityApplication.groupBy({ by: ["opportunityId", "status"], where: { orgId: s.orgId }, _count: { _all: true } }),
    ]);
    const byOpp: Record<string, Record<string, number>> = {};
    for (const c of counts) (byOpp[c.opportunityId] ??= {})[c.status] = c._count._all;
    return { success: true as const, opportunities: opportunities.map((o) => ({ ...o, counts: byOpp[o.id] ?? {} })), batches };
  } catch (e) {
    return failFrom(e);
  }
}

export async function saveOpportunity(raw: Record<string, unknown>, opportunityId?: string) {
  if (!FEATURES.opportunities) return NOT_ENABLED;
  const s = await staff();
  if (!s) return { success: false, error: "You don't have permission to do this" };
  try {
    const existing = opportunityId ? await db.opportunity.findFirst({ where: { id: opportunityId, orgId: s.orgId } }) : null;
    if (opportunityId && !existing) return { success: false, error: "Opportunity not found" };
    if (existing?.status === "CLOSED") return { success: false, error: "Re-open the opportunity before editing it." };
    const parsed = parseOpportunityInput(raw ?? {}, await orgDay(s.orgId), { publishing: existing?.status === "OPEN" });
    if (!parsed.ok) return { success: false, error: parsed.error };
    if (parsed.value.batchId) {
      const batch = await db.batch.findFirst({ where: { id: parsed.value.batchId, orgId: s.orgId }, select: { id: true } });
      if (!batch) return { success: false, error: "Batch not found in your academy." };
    }
    const row = existing
      ? await db.opportunity.update({ where: { id: existing.id }, data: parsed.value })
      : await db.opportunity.create({ data: { ...parsed.value, orgId: s.orgId, status: "DRAFT", createdById: s.userId } });
    await audit(s.userId, s.orgId, "OPPORTUNITY_SAVED", { opportunityId: row.id, created: !existing });
    refresh();
    return { success: true, id: row.id };
  } catch (e) {
    return failFrom(e);
  }
}

export async function setOpportunityStatus(opportunityId: string, status: string) {
  if (!FEATURES.opportunities) return NOT_ENABLED;
  if (!isOpportunityStatus(status)) return { success: false, error: "Invalid status" };
  const s = await staff();
  if (!s) return { success: false, error: "You don't have permission to do this" };
  try {
    const opp = await db.opportunity.findFirst({ where: { id: opportunityId, orgId: s.orgId } });
    if (!opp) return { success: false, error: "Opportunity not found" };
    if (!canChangeOpportunityStatus(opp.status, status)) return { success: false, error: `Can't move from ${opp.status} to ${status}.` };
    if (status === "OPEN" && opp.applyBy.getTime() < (await orgDay(s.orgId)).getTime()) {
      return { success: false, error: "The apply-by date has passed. Edit it before opening." };
    }
    await db.opportunity.update({ where: { id: opp.id }, data: { status } });
    await audit(s.userId, s.orgId, "OPPORTUNITY_STATUS_CHANGED", { opportunityId: opp.id, from: opp.status, to: status });
    refresh();
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

export async function listApplications(opportunityId: string) {
  if (!FEATURES.opportunities) return NOT_ENABLED;
  const s = await staff();
  if (!s) return { success: false as const, error: "You don't have permission to do this" };
  try {
    const opp = await db.opportunity.findFirst({ where: { id: opportunityId, orgId: s.orgId }, select: { id: true } });
    if (!opp) return { success: false as const, error: "Opportunity not found" };
    const apps = await db.opportunityApplication.findMany({
      where: { opportunityId: opp.id, orgId: s.orgId },
      orderBy: { createdAt: "asc" },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    const students = await db.student.findMany({
      where: { id: { in: apps.map((a) => a.studentId) }, orgId: s.orgId },
      select: { id: true, name: true, dob: true, enrollments: { select: { batch: { select: { name: true } } } } },
    });
    const byId = new Map(students.map((st) => [st.id, st]));
    return {
      success: true as const,
      applications: apps.map((a) => {
        const st = byId.get(a.studentId);
        return {
          id: a.id,
          status: a.status,
          note: a.note,
          guardianConsent: a.guardianConsent,
          consentAt: a.consentAt,
          createdAt: a.createdAt,
          studentId: a.studentId,
          studentName: st?.name ?? "Former student",
          dobOnFile: !!st?.dob,
          batches: st?.enrollments.map((e) => e.batch.name) ?? [],
          events: a.events.map((ev) => ({ id: ev.id, fromStatus: ev.fromStatus, toStatus: ev.toStatus, note: ev.note, createdAt: ev.createdAt })),
        };
      }),
    };
  } catch (e) {
    return failFrom(e);
  }
}

export async function setApplicationStatus(applicationId: string, to: string, note?: string) {
  if (!FEATURES.opportunities) return NOT_ENABLED;
  const s = await staff();
  if (!s) return { success: false, error: "You don't have permission to do this" };
  try {
    const app = await db.opportunityApplication.findFirst({ where: { id: applicationId, orgId: s.orgId } });
    if (!app) return { success: false, error: "Application not found" };
    if (!canTransitionApplication(app.status, to, "STAFF")) return { success: false, error: `Can't move from ${app.status} to ${to}.` };
    const cleanNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null;
    const ok = await db.$transaction(async (tx) => {
      const res = await tx.opportunityApplication.updateMany({ where: { id: app.id, orgId: s.orgId, status: app.status }, data: { status: to } });
      if (res.count === 0) return false;
      await tx.opportunityApplicationEvent.create({
        data: { orgId: s.orgId, applicationId: app.id, fromStatus: app.status, toStatus: to, actorId: s.userId, note: cleanNote },
      });
      return true;
    });
    if (!ok) return { success: false, error: "This application was just changed. Refresh and try again." };
    await audit(s.userId, s.orgId, "APPLICATION_STATUS_CHANGED", { applicationId: app.id, from: app.status, to });
    refresh();
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}

// ── Guardians ──────────────────────────────────────────────────────────────────

/** Open opportunities relevant to the parent's children, with each child's eligibility and application. */
export async function listOpportunitiesForParent() {
  if (!FEATURES.opportunities) return NOT_ENABLED;
  const session = await requireAuth(["PARENT"]);
  if (!session.orgId) return { success: true as const, opportunities: [] };
  const orgId = session.orgId as string;
  try {
    const children = await db.student.findMany({
      where: { parentId: session.id, orgId },
      select: { id: true, name: true, dob: true, enrollments: { select: { batchId: true } } },
    });
    if (!children.length) return { success: true as const, opportunities: [] };
    const batchIds = Array.from(new Set(children.flatMap((c) => c.enrollments.map((e) => e.batchId))));
    const today = await orgDay(orgId);
    const [opps, apps] = await Promise.all([
      db.opportunity.findMany({
        where: { orgId, status: { in: ["OPEN", "CLOSED"] }, OR: [{ batchId: null }, { batchId: { in: batchIds } }] },
        orderBy: { applyBy: "asc" },
        take: 30,
      }),
      db.opportunityApplication.findMany({
        where: { orgId, parentId: session.id, studentId: { in: children.map((c) => c.id) } },
        include: { events: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true } } },
      }),
    ]);
    return {
      success: true as const,
      opportunities: opps
        .map((o) => ({
          id: o.id, title: o.title, kind: o.kind, sport: o.sport, location: o.location, startDate: o.startDate, endDate: o.endDate,
          applyBy: o.applyBy, ageMin: o.ageMin, ageMax: o.ageMax, url: o.url, description: o.description, status: o.status,
          children: children.map((c) => {
            const app = apps.find((a) => a.opportunityId === o.id && a.studentId === c.id);
            const elig = checkEligibility(o, { dob: c.dob, batchIds: c.enrollments.map((e) => e.batchId) }, today);
            return {
              studentId: c.id,
              name: c.name,
              eligible: elig.ok,
              reason: elig.ok ? null : elig.reason,
              ageUnknown: elig.ok ? elig.ageUnknown : false,
              application: app ? { id: app.id, status: app.status, history: app.events } : null,
            };
          }),
        }))
        // Closed ones only matter if one of the children applied.
        .filter((o) => o.status === "OPEN" || o.children.some((c) => c.application)),
    };
  } catch (e) {
    return failFrom(e);
  }
}

export async function applyToOpportunity(opportunityId: string, studentId: string, guardianConsent: boolean, note?: string) {
  if (!FEATURES.opportunities) return NOT_ENABLED;
  const session = await requireAuth(["PARENT"]);
  if (!session.orgId) return { success: false, error: "No academy found" };
  const orgId = session.orgId as string;
  if (guardianConsent !== true) return { success: false, error: "Please confirm you consent to share your child's academy profile for this application." };
  try {
    const [opp, child] = await Promise.all([
      db.opportunity.findFirst({ where: { id: opportunityId, orgId } }),
      db.student.findFirst({ where: { id: studentId, parentId: session.id, orgId }, select: { id: true, dob: true, enrollments: { select: { batchId: true } } } }),
    ]);
    if (!opp || !child) return { success: false, error: "Not found" };
    const elig = checkEligibility(opp, { dob: child.dob, batchIds: child.enrollments.map((e) => e.batchId) }, await orgDay(orgId));
    if (!elig.ok) return { success: false, error: elig.reason };
    const existing = await db.opportunityApplication.findUnique({ where: { opportunityId_studentId: { opportunityId: opp.id, studentId: child.id } } });
    if (existing && existing.status !== "WITHDRAWN") return { success: true, alreadyApplied: true };
    const cleanNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null;
    const now = new Date();
    const appId = await db.$transaction(async (tx) => {
      const app = existing
        ? await tx.opportunityApplication.update({
            where: { id: existing.id },
            data: { status: "APPLIED", guardianConsent: true, consentAt: now, note: cleanNote, parentId: session.id },
          })
        : await tx.opportunityApplication.create({
            data: { orgId, opportunityId: opp.id, studentId: child.id, parentId: session.id, status: "APPLIED", guardianConsent: true, consentAt: now, note: cleanNote },
          });
      await tx.opportunityApplicationEvent.create({
        data: { orgId, applicationId: app.id, fromStatus: existing?.status ?? null, toStatus: "APPLIED", actorId: session.id, note: "Guardian consent given" },
      });
      return app.id;
    });
    await audit(session.id, orgId, "OPPORTUNITY_APPLIED", { opportunityId: opp.id, applicationId: appId, studentId: child.id, reapplied: !!existing });
    refresh();
    return { success: true, id: appId };
  } catch (e: any) {
    if (e?.code === "P2002") return { success: true, alreadyApplied: true };
    return failFrom(e);
  }
}

export async function withdrawApplication(applicationId: string) {
  if (!FEATURES.opportunities) return NOT_ENABLED;
  const session = await requireAuth(["PARENT"]);
  if (!session.orgId) return { success: false, error: "No academy found" };
  const orgId = session.orgId as string;
  try {
    const app = await db.opportunityApplication.findFirst({ where: { id: applicationId, orgId, parentId: session.id } });
    if (!app) return { success: false, error: "Application not found" };
    if (!canTransitionApplication(app.status, "WITHDRAWN", "GUARDIAN")) return { success: false, error: "This application can no longer be withdrawn." };
    await db.$transaction([
      db.opportunityApplication.update({ where: { id: app.id }, data: { status: "WITHDRAWN" } }),
      db.opportunityApplicationEvent.create({ data: { orgId, applicationId: app.id, fromStatus: app.status, toStatus: "WITHDRAWN", actorId: session.id } }),
    ]);
    await audit(session.id, orgId, "APPLICATION_WITHDRAWN", { applicationId: app.id, from: app.status });
    refresh();
    return { success: true };
  } catch (e) {
    return failFrom(e);
  }
}
