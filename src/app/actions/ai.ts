"use server";

import { db } from "@/lib/db";
import { getSession, requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { rateLimitDb } from "@/lib/rate-limit";
import { istMonthString } from "@/lib/fees";
import { getSportConfig } from "@/lib/sport-metrics";
import { aiConfigured, callClaude } from "@/lib/ai/client";
import { REPORT_SYSTEM, SKILL_NOTE_SYSTEM, buildReportPrompt, buildSkillNotePrompt, clampScore } from "@/lib/ai/prompts";
import { REGISTER_PROMPT, REGISTER_SYSTEM, parseRegisterReply, type RegisterRow } from "@/lib/ai/register";
import { loadBusinessReportInput } from "@/lib/business-report-data";
import { computeBusinessReport, isReportMonth } from "@/lib/business-report";

type Result = { success: true; text: string } | { success: false; error: string };

/** Whether AI buttons should be shown. Signed-in staff only; reveals nothing else. */
export async function getAiStatus(): Promise<{ available: boolean }> {
  const session = await getSession();
  if (!session || session.role === "PARENT") return { available: false };
  return { available: aiConfigured() };
}

/**
 * Draft the parent-facing note on a monthly skill report. The coach reviews and edits before saving —
 * nothing is saved or sent here. Only sport, month, scores and the coach's own points go to the AI.
 */
export async function draftSkillNote(input: {
  studentId: string;
  sport?: string | null;
  month: string;
  scores: Record<string, number>;
  points: string;
}): Promise<Result> {
  const session = await requireAuth(["ADMIN", "COACH"]);
  if (!aiConfigured()) return { success: false, error: "AI is not switched on for this academy yet." };
  const orgId = session.orgId || "__no_org__";

  // Same access rule as submitSkillReport: coaches only for students in their own batches.
  const student = await db.student.findFirst({
    where: session.role === "COACH"
      ? { id: String(input.studentId), orgId, enrollments: { some: { batch: { coachId: session.id, orgId } } } }
      : { id: String(input.studentId), orgId },
    select: { id: true },
  });
  if (!student) return { success: false, error: "Student not found" };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(input.month))) return { success: false, error: "Invalid month" };

  const rl = await rateLimitDb(`ai:note:${session.id}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) return { success: false, error: "Too many drafts this hour. Please write this one yourself or try later." };

  const config = getSportConfig(input.sport);
  const scores = input.scores && typeof input.scores === "object" ? input.scores : {};
  const dimensions = config.dimensions.map((d) => ({ label: d.label, score: clampScore(scores[d.key] ?? 3) }));

  const res = await callClaude({
    feature: "skill_note",
    system: SKILL_NOTE_SYSTEM,
    prompt: buildSkillNotePrompt({ sport: config.name, month: input.month, dimensions, coachPoints: String(input.points ?? "") }),
    maxTokens: 1200,
    orgId: session.orgId ?? null,
    userId: session.id as string,
  });
  if (!res.ok) return { success: false, error: res.error };
  return { success: true, text: res.text.slice(0, 1000) };
}

/** Plain-language explanation of one month's business report. Aggregates only; needs reports.view. */
export async function explainBusinessReport(month: string): Promise<Result> {
  if (!FEATURES.businessReport) return { success: false, error: "The business report is not enabled." };
  const auth = await checkPermission("reports.view");
  if (!auth.ok) return { success: false, error: auth.error };
  if (!aiConfigured()) return { success: false, error: "AI is not switched on for this academy yet." };
  const orgId = auth.session.orgId;

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { currency: true, timezone: true } });
  const current = istMonthString(new Date(), org?.timezone || "Asia/Kolkata");
  if (!isReportMonth(month, current)) return { success: false, error: "Pick a month up to the current one." };

  const rl = await rateLimitDb(`ai:report:${orgId}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) return { success: false, error: "Too many explanations this hour. Please try later." };

  const { input } = await loadBusinessReportInput(orgId, month);
  const report = computeBusinessReport(input);

  const res = await callClaude({
    feature: "business_report",
    system: REPORT_SYSTEM,
    prompt: buildReportPrompt(report, org?.currency || "INR"),
    maxTokens: 2000,
    orgId,
    userId: auth.session.id as string,
  });
  if (!res.ok) return { success: false, error: res.error };
  return { success: true, text: res.text.slice(0, 2500) };
}

const REGISTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const REGISTER_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Read a photo of a paper register into rows for the admin to review. Nothing is imported here and
 * the photo is not stored — the admin checks every row, then imports through importStudents.
 */
export async function readRegisterPhoto(
  formData: FormData,
): Promise<{ success: true; rows: RegisterRow[]; truncated: boolean } | { success: false; error: string }> {
  const auth = await checkPermission("students.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  if (!aiConfigured()) return { success: false, error: "AI is not switched on for this academy yet." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Choose a photo of the register first." };
  if (!REGISTER_TYPES.has(file.type)) return { success: false, error: "Please use a JPG, PNG or WebP photo." };
  if (file.size > REGISTER_MAX_BYTES) return { success: false, error: "That photo is too large. Please try a smaller one." };

  const orgId = auth.session.orgId;
  const rl = await rateLimitDb(`ai:register:${orgId}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) return { success: false, error: "Too many photos this hour. Please try again later." };

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const res = await callClaude({
    feature: "register_import",
    system: REGISTER_SYSTEM,
    prompt: REGISTER_PROMPT,
    image: { mediaType: file.type as "image/jpeg" | "image/png" | "image/webp", base64 },
    maxTokens: 8000,
    orgId,
    userId: auth.session.id as string,
  });
  if (!res.ok) return { success: false, error: res.error };

  const parsed = parseRegisterReply(res.text);
  if (parsed.rows.length === 0) {
    return { success: false, error: "No student rows could be read. Try a sharper, well-lit photo of one page." };
  }
  return { success: true, rows: parsed.rows, truncated: parsed.truncated };
}
