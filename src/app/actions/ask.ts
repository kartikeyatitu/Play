"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { rateLimitDb } from "@/lib/rate-limit";
import { istDateString } from "@/lib/fees";
import { aiConfigured, callClaude } from "@/lib/ai/client";
import { redactContactDetails } from "@/lib/ai/redact";
import { ASK_EXAMPLES, askSystemPrompt, intentTitle, parseAskRoute, type AskAnswer } from "@/lib/ask";
import {
  answerAtRisk,
  answerBatches,
  answerOutstanding,
  answerRetention,
  answerSources,
  answerToday,
  answerTrend,
} from "@/lib/ask-answers";
import { loadOwnerInsights } from "@/lib/insights-data";
import { loadAtRiskStudents } from "@/lib/risk-data";
import { loadFunnelAndCohorts } from "@/lib/funnel-data";
import { loadBusinessReportInput } from "@/lib/business-report-data";
import { computeBusinessReport } from "@/lib/business-report";

type AskResult =
  | { success: true; answer: AskAnswer }
  | { success: true; unsupported: true; examples: string[] }
  | { success: false; error: string };

/**
 * Ask TRIQ: the AI only picks one approved report for the question; the report then runs on this academy's
 * data with the same permission as the Analytics tab (reports.view). Numbers never come from the AI.
 */
export async function askTriq(question: string): Promise<AskResult> {
  if (!FEATURES.askTriq) return { success: false, error: "Ask TRIQ is not enabled." };
  const auth = await checkPermission("reports.view");
  if (!auth.ok) return { success: false, error: auth.error };
  if (!aiConfigured()) return { success: false, error: "AI is not switched on for this academy yet." };

  const q = String(question ?? "").trim();
  if (q.length < 3) return { success: false, error: "Type a question first." };
  if (q.length > 300) return { success: false, error: "Please keep the question under 300 characters." };

  const orgId = auth.session.orgId;
  const rl = await rateLimitDb(`ai:ask:${orgId}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) return { success: false, error: "Too many questions this hour. Please try again later." };

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true, currency: true } });
  const currentMonth = istDateString(new Date(), org?.timezone || "Asia/Kolkata").slice(0, 7);

  const routed = await callClaude({
    feature: "ask_triq",
    system: askSystemPrompt(currentMonth),
    prompt: redactContactDetails(q),
    maxTokens: 300,
    orgId,
    userId: auth.session.id as string,
  });
  if (!routed.ok) return { success: false, error: routed.error };

  const route = parseAskRoute(routed.text, currentMonth);
  if (route.intent === "unsupported") return { success: true, unsupported: true, examples: ASK_EXAMPLES };
  const title = intentTitle(route);

  try {
    switch (route.intent) {
      case "outstanding_fees": {
        const [insights, top] = await Promise.all([loadOwnerInsights(orgId), topOwing(orgId, currentMonth)]);
        return { success: true, answer: answerOutstanding(title, insights, top) };
      }
      case "unpaid_by_batch":
      case "attendance_by_batch":
      case "batch_fill": {
        const { input } = await loadBusinessReportInput(orgId, route.month);
        const kind = route.intent === "unpaid_by_batch" ? "unpaid" : route.intent === "attendance_by_batch" ? "attendance" : "fill";
        return { success: true, answer: answerBatches(title, kind, computeBusinessReport(input), org?.currency || "INR") };
      }
      case "collections_trend":
      case "new_students":
        return { success: true, answer: answerTrend(title, route.intent === "new_students" ? "new_students" : "collections", await loadOwnerInsights(orgId)) };
      case "today_snapshot":
        return { success: true, answer: answerToday(title, await loadOwnerInsights(orgId)) };
      case "at_risk_students":
        return { success: true, answer: answerAtRisk(title, await loadAtRiskStudents(orgId, { canContact: false })) };
      case "enquiry_sources":
        return { success: true, answer: answerSources(title, await loadFunnelAndCohorts(orgId)) };
      case "retention":
        return { success: true, answer: answerRetention(title, await loadFunnelAndCohorts(orgId)) };
    }
  } catch (e) {
    console.error("[ask] report failed", route.intent, e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't run that report. Please try again." };
  }
}

/** Students with the most unpaid fees up to the current month (top 10). */
async function topOwing(orgId: string, currentMonth: string): Promise<{ name: string; amount: number; months: number }[]> {
  const feeScope: Prisma.FeeRecordWhereInput = { OR: [{ orgId }, { student: { orgId } }] };
  const groups = await db.feeRecord.groupBy({
    by: ["studentId"],
    where: { AND: [feeScope, { status: { not: "PAID" } }, { month: { lte: currentMonth } }] },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  });
  if (groups.length === 0) return [];
  const students = await db.student.findMany({ where: { orgId, id: { in: groups.map((g) => g.studentId) } }, select: { id: true, name: true } });
  const names = new Map(students.map((s) => [s.id, s.name]));
  return groups
    .filter((g) => names.has(g.studentId))
    .map((g) => ({ name: names.get(g.studentId)!, amount: g._sum.amount ?? 0, months: g._count._all }));
}
