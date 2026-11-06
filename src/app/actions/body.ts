"use server";

/**
 * TRIQ Body server actions. Every action that touches FitnessResult, Drill, SessionPlan or
 * SessionPlanItem checks its flag FIRST and returns before any query when the flag is off, because
 * those tables are not in production yet (docs/specs/wave2-schema.md).
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getBodyViewer, studentAccess, isTeam, canPlan, canUsePlan, plannableBatches, canManageAllPlans } from "@/lib/body/access";
import { getFitnessTest, parseFitnessValue, wouldBePersonalBest } from "@/lib/body/tests";
import { DRILL_AGE_GROUPS, DRILL_FOCUS, sportKey } from "@/lib/body/drills";
import { addDays, buildPlanNotes, clampText, cleanPlanItems, parseDay, pickLastWeekPlan } from "@/lib/body/plans";

const NOT_ENABLED = "Not enabled yet for your academy.";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function back(path: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(q ? `${path}?${q}` : path);
}

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  try {
    await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } });
  } catch (e) {
    console.warn("[body] audit failed", e);
  }
}

// ---- Fitness tests (flag fitnessTests) ---------------------------------------------------------

export async function recordFitnessResult(formData: FormData) {
  const studentId = str(formData, "studentId").slice(0, 40);
  const path = `/body/athlete/${encodeURIComponent(studentId)}`;
  if (!FEATURES.fitnessTests) back(path, { error: NOT_ENABLED });

  const v = await getBodyViewer();
  const access = await studentAccess(v, studentId);
  if (!access.canRecord || !v.orgId) back(path, { error: "You can only record tests for athletes in your own batches." });

  const test = getFitnessTest(str(formData, "testKey"));
  if (!test) back(path, { error: "Choose a test from the catalogue." });
  const value = parseFitnessValue(test, str(formData, "value"));
  if (value === null) back(path, { error: `Enter a ${test.name} result between ${test.min} and ${test.max} ${test.unit}.` });

  const day = parseDay(str(formData, "date"));
  const now = new Date();
  if (day && day.getTime() > now.getTime() + 24 * 60 * 60 * 1000) back(path, { error: "The test date can't be in the future." });
  const recordedAt = day ?? now;
  const notes = clampText(formData.get("notes"), 300) || null;

  const previous = await db.fitnessResult.findMany({
    where: { orgId: v.orgId, studentId, testKey: test.key, unit: test.unit },
    select: { id: true, testKey: true, value: true, unit: true, recordedAt: true },
  });
  const pb = wouldBePersonalBest(
    previous.map((r) => ({ ...r, value: Number(r.value) })),
    test.key,
    value,
  );
  const row = await db.fitnessResult.create({
    data: { orgId: v.orgId, studentId, testKey: test.key, value, unit: test.unit, notes, recordedAt, recordedById: v.userId },
    select: { id: true },
  });
  await audit(v.userId, v.orgId, "BODY_FITNESS_RECORD", { resultId: row.id, studentId, testKey: test.key });
  revalidatePath(path);
  back(path, { saved: "1", ...(pb ? { pb: test.key } : {}) });
}

export async function deleteFitnessResult(formData: FormData) {
  const studentId = str(formData, "studentId").slice(0, 40);
  const path = `/body/athlete/${encodeURIComponent(studentId)}`;
  if (!FEATURES.fitnessTests) back(path, { error: NOT_ENABLED });

  const v = await getBodyViewer();
  const access = await studentAccess(v, studentId);
  if (!access.canRecord || !v.orgId) back(path, { error: "You don't have permission to do this." });
  const id = str(formData, "id").slice(0, 40);
  const row = await db.fitnessResult.findFirst({ where: { id, orgId: v.orgId, studentId }, select: { id: true, recordedById: true } });
  if (!row) back(path, { error: "Result not found." });
  // Coaches may remove only what they recorded; managers with students.manage may remove any.
  if (v.membership?.role === "COACH" && row.recordedById !== v.userId) back(path, { error: "You can only remove results you recorded." });
  await db.fitnessResult.delete({ where: { id: row.id } });
  await audit(v.userId, v.orgId, "BODY_FITNESS_DELETE", { resultId: row.id, studentId });
  revalidatePath(path);
  back(path, { saved: "1" });
}

// ---- Custom drills (flag drillLibrary) ---------------------------------------------------------

export async function createCustomDrill(formData: FormData) {
  const path = "/body/drills";
  if (!FEATURES.drillLibrary) back(path, { error: NOT_ENABLED });
  const v = await getBodyViewer();
  if (!isTeam(v) || !v.orgId || !canPlan(v)) back(path, { error: "Only coaches and managers can add academy drills." });

  const sport = sportKey(str(formData, "sport"));
  const title = clampText(formData.get("title"), 100);
  const description = clampText(formData.get("description"), 1000) || null;
  const mins = Math.round(Number(str(formData, "durationMin")));
  const ageGroup = str(formData, "ageGroup");
  const focus = formData.getAll("focus").filter((f): f is string => typeof f === "string" && (DRILL_FOCUS as readonly string[]).includes(f));
  const equipment = str(formData, "equipment")
    .split(",")
    .map((e) => clampText(e, 40))
    .filter(Boolean)
    .slice(0, 10);
  if (!sport) back(path, { error: "Choose a sport." });
  if (!title) back(path, { error: "Give the drill a title." });
  if (!Number.isFinite(mins) || mins < 1 || mins > 180) back(path, { error: "Duration must be 1 to 180 minutes." });

  const row = await db.drill.create({
    data: {
      orgId: v.orgId,
      sport,
      title,
      description,
      durationMin: mins,
      equipment,
      ageGroup: (DRILL_AGE_GROUPS as readonly string[]).includes(ageGroup) ? ageGroup : "All ages",
      skillKeys: focus,
      createdById: v.userId,
    },
    select: { id: true },
  });
  await audit(v.userId, v.orgId, "BODY_DRILL_CREATE", { drillId: row.id });
  revalidatePath(path);
  back(path, { saved: "1", sport });
}

export async function archiveCustomDrill(formData: FormData) {
  const path = "/body/drills";
  if (!FEATURES.drillLibrary) back(path, { error: NOT_ENABLED });
  const v = await getBodyViewer();
  if (!isTeam(v) || !v.orgId || !canPlan(v)) back(path, { error: "You don't have permission to do this." });
  const id = str(formData, "id").slice(0, 40);
  const drill = await db.drill.findFirst({ where: { id, orgId: v.orgId, archivedAt: null }, select: { id: true, createdById: true } });
  if (!drill) back(path, { error: "Drill not found." });
  if (!canManageAllPlans(v) && drill.createdById !== v.userId) back(path, { error: "You can only archive drills you added." });
  await db.drill.update({ where: { id: drill.id }, data: { archivedAt: new Date() } });
  await audit(v.userId, v.orgId, "BODY_DRILL_ARCHIVE", { drillId: drill.id });
  revalidatePath(path);
  back(path, { saved: "1" });
}

// ---- Session plans (flag drillLibrary) ---------------------------------------------------------

export async function saveSessionPlan(formData: FormData) {
  const planId = str(formData, "planId").slice(0, 40);
  const editPath = planId ? `/body/plans/${encodeURIComponent(planId)}` : "/body/plans/new";
  if (!FEATURES.drillLibrary) back(editPath, { error: NOT_ENABLED });

  const v = await getBodyViewer();
  if (!v.orgId || !canPlan(v)) back(editPath, { error: "Only coaches and managers can save session plans." });
  const orgId = v.orgId;

  const title = clampText(formData.get("title"), 120);
  if (!title) back(editPath, { error: "Give the plan a title." });
  const batchId = str(formData, "batchId").slice(0, 40) || null;
  const date = str(formData, "date") ? parseDay(str(formData, "date")) : null;
  if (str(formData, "date") && !date) back(editPath, { error: "Choose a valid date." });

  const batches = await plannableBatches(v);
  const batch = batchId ? batches.find((b) => b.id === batchId) : null;
  if (batchId && !batch) back(editPath, { error: "You can only plan for your own batches." });
  if (!batchId && v.membership?.role !== "COACH" && !canManageAllPlans(v)) back(editPath, { error: "Choose a batch." });
  const sport = sportKey(str(formData, "sport")) ?? sportKey(batch?.sport) ?? (clampText(batch?.sport ?? str(formData, "sport"), 40) || "general");

  const { items, error } = cleanPlanItems(str(formData, "items"));
  if (error) back(editPath, { error });
  if (!items.length) back(editPath, { error: "Add at least one drill or item." });

  // Custom drill ids must belong to this academy and not be archived; anything else becomes free text.
  const drillIds = [...new Set(items.map((i) => i.drillId).filter((x): x is string => Boolean(x)))];
  const okDrills = drillIds.length
    ? new Set((await db.drill.findMany({ where: { id: { in: drillIds }, orgId, archivedAt: null }, select: { id: true } })).map((d) => d.id))
    : new Set<string>();
  const notes = buildPlanNotes(Number(str(formData, "sessionMinutes")), str(formData, "notes"));

  let id = planId;
  if (planId) {
    const existing = await db.sessionPlan.findFirst({ where: { id: planId, orgId }, select: { id: true, orgId: true, batchId: true, createdById: true } });
    if (!existing) back("/body/plans", { error: "Plan not found." });
    const existingCoach = existing.batchId ? (await db.batch.findFirst({ where: { id: existing.batchId, orgId }, select: { coachId: true } }))?.coachId ?? null : null;
    if (!canUsePlan(v, existing, existingCoach)) back("/body/plans", { error: "You can only edit plans for your own batches." });
  }

  await db.$transaction(async (tx) => {
    if (planId) {
      await tx.sessionPlan.update({ where: { id: planId }, data: { title, sport, batchId, date, notes } });
      await tx.sessionPlanItem.deleteMany({ where: { planId, orgId } });
    } else {
      const created = await tx.sessionPlan.create({ data: { orgId, title, sport, batchId, date, notes, createdById: v.userId }, select: { id: true } });
      id = created.id;
    }
    await tx.sessionPlanItem.createMany({
      data: items.map((i) => ({
        orgId,
        planId: id,
        drillId: i.drillId && okDrills.has(i.drillId) ? i.drillId : null,
        order: i.order,
        title: i.title,
        durationMin: i.durationMin,
        notes: i.notes,
      })),
    });
  });
  await audit(v.userId, orgId, planId ? "BODY_PLAN_UPDATE" : "BODY_PLAN_CREATE", { planId: id, items: items.length });
  revalidatePath("/body/plans");
  back(`/body/plans/${encodeURIComponent(id)}`, { saved: "1" });
}

export async function copyLastWeekPlan(formData: FormData) {
  const path = "/body/plans";
  if (!FEATURES.drillLibrary) back(path, { error: NOT_ENABLED });
  const v = await getBodyViewer();
  if (!v.orgId || !canPlan(v)) back(path, { error: "Only coaches and managers can copy session plans." });
  const orgId = v.orgId;

  const batchId = str(formData, "batchId").slice(0, 40);
  const target = parseDay(str(formData, "date"));
  if (!target) back(path, { error: "Choose the date to plan for." });
  const batches = await plannableBatches(v);
  if (!batches.some((b) => b.id === batchId)) back(path, { error: "You can only copy plans for your own batches." });

  const candidates = await db.sessionPlan.findMany({
    where: { orgId, batchId, date: { gte: addDays(target, -7), lte: addDays(target, -1) } },
    select: { id: true, date: true, updatedAt: true },
  });
  const pick = pickLastWeekPlan(candidates, target);
  if (!pick) back(path, { error: "No plan for this batch in the 7 days before that date." });

  const source = await db.sessionPlan.findFirst({
    where: { id: pick.id, orgId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!source) back(path, { error: "Plan not found." });

  const copy = await db.$transaction(async (tx) => {
    const created = await tx.sessionPlan.create({
      data: { orgId, batchId, title: source.title, sport: source.sport, date: target, notes: source.notes, createdById: v.userId },
      select: { id: true },
    });
    if (source.items.length) {
      await tx.sessionPlanItem.createMany({
        data: source.items.map((i, n) => ({ orgId, planId: created.id, drillId: i.drillId, order: n, title: i.title, durationMin: i.durationMin, notes: i.notes })),
      });
    }
    return created;
  });
  await audit(v.userId, orgId, "BODY_PLAN_COPY", { from: source.id, planId: copy.id });
  revalidatePath(path);
  back(`/body/plans/${encodeURIComponent(copy.id)}`, { saved: "1" });
}

export async function deleteSessionPlan(formData: FormData) {
  const path = "/body/plans";
  if (!FEATURES.drillLibrary) back(path, { error: NOT_ENABLED });
  const v = await getBodyViewer();
  if (!v.orgId) back(path, { error: "No academy found." });
  const id = str(formData, "planId").slice(0, 40);
  const plan = await db.sessionPlan.findFirst({ where: { id, orgId: v.orgId }, select: { id: true, orgId: true, batchId: true, createdById: true } });
  if (!plan) back(path, { error: "Plan not found." });
  const coachId = plan.batchId ? (await db.batch.findFirst({ where: { id: plan.batchId, orgId: v.orgId }, select: { coachId: true } }))?.coachId ?? null : null;
  if (!canUsePlan(v, plan, coachId)) back(path, { error: "You can only delete plans for your own batches." });
  await db.sessionPlan.delete({ where: { id: plan.id } });
  await audit(v.userId, v.orgId, "BODY_PLAN_DELETE", { planId: plan.id });
  revalidatePath(path);
  back(path, { saved: "1" });
}
