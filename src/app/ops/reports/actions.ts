"use server";

// Triq ops content moderation for Creators. SUPER_ADMIN only; every action is audited.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { isReportTarget } from "@/lib/creators";

const PATH = "/ops/reports";

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function back(error?: string): never {
  redirect(error ? `${PATH}?error=${encodeURIComponent(error)}` : `${PATH}?saved=1`);
}

async function setHidden(targetType: string, targetId: string, hidden: boolean, moderatorId: string) {
  const data = hidden ? { hiddenAt: new Date(), hiddenById: moderatorId } : { hiddenAt: null, hiddenById: null };
  if (targetType === "CREATOR_PROFILE") return (await db.creatorProfile.updateMany({ where: { id: targetId }, data })).count;
  return (await db.creatorPortfolioItem.updateMany({ where: { id: targetId }, data })).count;
}

/** decision: HIDE (hide the target, mark ACTIONED) | DISMISS. */
export async function resolveReport(formData: FormData): Promise<void> {
  const session = await requireAuth(["SUPER_ADMIN"]);
  if (!FEATURES.creators) back("Creators is switched off");
  const id = formData.get("id");
  const decision = String(formData.get("decision") || "");
  if (!validId(id) || (decision !== "HIDE" && decision !== "DISMISS")) back("Invalid request");
  const report = await db.contentReport.findUnique({ where: { id } });
  if (!report || report.status !== "OPEN") back("Report not found or already resolved");
  if (decision === "HIDE") await setHidden(report.targetType, report.targetId, true, session.id);
  const status = decision === "HIDE" ? "ACTIONED" : "DISMISSED";
  // Resolve every open report on the same target together.
  await db.contentReport.updateMany({
    where: { targetType: report.targetType, targetId: report.targetId, status: "OPEN" },
    data: { status, resolvedById: session.id, resolvedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      userId: session.id,
      orgId: null,
      action: "CONTENT_REPORT_RESOLVED",
      details: JSON.stringify({ reportId: report.id, targetType: report.targetType, targetId: report.targetId, decision }),
    },
  });
  revalidatePath(PATH);
  back();
}

export async function setContentHidden(formData: FormData): Promise<void> {
  const session = await requireAuth(["SUPER_ADMIN"]);
  if (!FEATURES.creators) back("Creators is switched off");
  const targetType = formData.get("targetType");
  const targetId = formData.get("targetId");
  const hidden = formData.get("hidden") === "1";
  if (!isReportTarget(targetType) || !validId(targetId)) back("Invalid request");
  const count = await setHidden(targetType, targetId, hidden, session.id);
  if (!count) back("Content not found");
  const kind = targetType === "CREATOR_PROFILE" ? "CREATOR" : "CREATOR_ITEM";
  await db.auditLog.create({
    data: {
      userId: session.id,
      orgId: null,
      action: `${kind}_${hidden ? "HIDDEN" : "UNHIDDEN"}`,
      details: JSON.stringify({ targetType, targetId }),
    },
  });
  revalidatePath(PATH);
  back();
}
