import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { DEFAULT_AI_MODEL, costUsd, monthStartUtc, monthlyBudgetUsd, sumLoggedCost, withinBudget } from "./usage";

/**
 * Server-only Claude API client. Every call:
 *  1. needs the aiAssist flag and an ANTHROPIC_API_KEY,
 *  2. checks the platform-wide monthly budget (AI_MONTHLY_BUDGET_INR),
 *  3. logs model, tokens and cost to AuditLog (action AI_USAGE) — never the prompt or the reply.
 */

export const AI_USAGE_ACTION = "AI_USAGE";
const API_URL = "https://api.anthropic.com/v1/messages";

export function aiConfigured(): boolean {
  return FEATURES.aiAssist && !!process.env.ANTHROPIC_API_KEY;
}

export type AiResult = { ok: true; text: string } | { ok: false; error: string };

export async function callClaude(opts: {
  feature: string;
  system: string;
  prompt: string;
  maxTokens: number;
  orgId: string | null;
  userId: string;
}): Promise<AiResult> {
  if (!aiConfigured()) return { ok: false, error: "AI is not switched on for this academy yet." };
  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;

  // Budget: spent so far this month + worst case for this call (prompt estimate at ~4 chars/token, full output).
  const rows = await db.auditLog.findMany({
    where: { action: AI_USAGE_ACTION, createdAt: { gte: monthStartUtc(new Date()) } },
    select: { details: true },
  });
  const estimate = costUsd(model, Math.ceil((opts.system.length + opts.prompt.length) / 3), opts.maxTokens);
  if (!withinBudget(sumLoggedCost(rows), monthlyBudgetUsd(process.env), estimate)) {
    return { ok: false, error: "This month's AI budget has been used up. It resets on the 1st." };
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "The AI service didn't respond. Please try again." };
  }

  if (!res.ok) {
    console.error(`[ai] ${opts.feature} failed with HTTP ${res.status}`);
    return { ok: false, error: res.status === 429 ? "The AI service is busy. Try again in a minute." : "The AI service returned an error. Please try again." };
  }

  const body = (await res.json().catch(() => null)) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  } | null;
  const text = (body?.content ?? []).filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n").trim();
  const inputTokens = body?.usage?.input_tokens ?? 0;
  const outputTokens = body?.usage?.output_tokens ?? 0;

  await db.auditLog
    .create({
      data: {
        userId: opts.userId,
        orgId: opts.orgId,
        action: AI_USAGE_ACTION,
        details: JSON.stringify({ feature: opts.feature, model, inputTokens, outputTokens, costUsd: costUsd(model, inputTokens, outputTokens) }),
      },
    })
    .catch((e) => console.error("[ai] usage log failed", e instanceof Error ? e.message : e));

  if (!text) return { ok: false, error: "The AI didn't return any text. Please try again." };
  return { ok: true, text };
}
