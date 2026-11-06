/**
 * Load one session plan for a viewer. Server-only (database). Callers must check
 * FEATURES.drillLibrary BEFORE calling: this reads SessionPlan and SessionPlanItem.
 */
import { db } from "@/lib/db";
import { canUsePlan, type BodyViewer } from "@/lib/body/access";
import { parsePlanNotes } from "@/lib/body/plans";

export async function loadPlanForViewer(viewer: BodyViewer, planId: string) {
  if (!viewer.orgId || typeof planId !== "string" || !planId) return null;
  const plan = await db.sessionPlan.findFirst({
    where: { id: planId.slice(0, 40), orgId: viewer.orgId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!plan) return null;
  const batch = plan.batchId
    ? await db.batch.findFirst({ where: { id: plan.batchId, orgId: viewer.orgId }, select: { id: true, name: true, coachId: true } })
    : null;
  if (!canUsePlan(viewer, plan, batch?.coachId ?? null)) return null;
  const { sessionMinutes, text } = parsePlanNotes(plan.notes);
  return { plan, batch, sessionMinutes, notesText: text };
}
