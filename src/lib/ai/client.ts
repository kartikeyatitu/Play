import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { AI_MONTHLY_ACTIONS, canonicalPlan } from "@/lib/pricing";
import { DEFAULT_AI_MODEL, aiActionsRemaining, costUsd, monthStartUtc, monthlyBudgetUsd, sumLoggedCost, withinBudget } from "./usage";
import { redactForModel, type NamedPerson } from "./redact-names";
import { loadNameRoster } from "./name-roster";

/**
 * Server-only Claude API client. Every call:
 *  1. needs the aiAssist flag and an ANTHROPIC_API_KEY,
 *  2. checks the platform-wide monthly budget (AI_MONTHLY_BUDGET_INR),
 *  3. replaces student and parent names with [Child n] / [Parent n] and strips contact details and
 *     dates of birth from the system prompt and prompt before sending; names are restored in the reply
 *     on the server only (fails closed if the roster cannot be loaded),
 *  4. logs model, tokens and cost to AuditLog (action AI_USAGE) — never the prompt or the reply.
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
  /** Optional image (base64, no data: prefix) sent before the prompt text. */
  image?: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };
  maxTokens: number;
  orgId: string | null;
  userId: string;
}): Promise<AiResult> {
  if (!aiConfigured()) return { ok: false, error: "AI is not switched on for this academy yet." };
  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;

  // Per-academy monthly allowance by plan (Free 50, paid plans 1,000) — see AI_MONTHLY_ACTIONS.
  if (opts.orgId) {
    const [sub, org, used] = await Promise.all([
      db.subscription.findUnique({ where: { orgId: opts.orgId }, select: { plan: true } }),
      db.organization.findUnique({ where: { id: opts.orgId }, select: { plan: true } }),
      db.auditLog.count({ where: { orgId: opts.orgId, action: AI_USAGE_ACTION, createdAt: { gte: monthStartUtc(new Date()) } } }),
    ]);
    const plan = canonicalPlan(sub?.plan ?? org?.plan ?? "free");
    if (aiActionsRemaining(AI_MONTHLY_ACTIONS[plan], used) === 0) {
      return {
        ok: false,
        error:
          plan === "free"
            ? `Your academy has used its ${AI_MONTHLY_ACTIONS.free} free AI actions this month. Growth includes ${AI_MONTHLY_ACTIONS.growth.toLocaleString("en-IN")} a month.`
            : "Your academy has used this month's AI actions. They reset on the 1st.",
      };
    }
  }

  // Budget: spent so far this month + worst case for this call (prompt estimate at ~4 chars/token, full output).
  const rows = await db.auditLog.findMany({
    where: { action: AI_USAGE_ACTION, createdAt: { gte: monthStartUtc(new Date()) } },
    select: { details: true },
  });
  // Images cost roughly width×height/750 tokens; a 1600px photo is under ~3,500.
  const imageTokens = opts.image ? 3500 : 0;
  const estimate = costUsd(model, Math.ceil((opts.system.length + opts.prompt.length) / 3) + imageTokens, opts.maxTokens);
  if (!withinBudget(sumLoggedCost(rows), monthlyBudgetUsd(process.env), estimate)) {
    return { ok: false, error: "This month's AI budget has been used up. It resets on the 1st." };
  }

  // Names come from this academy's own roster. If it cannot be loaded, do not send the text unredacted.
  let roster: NamedPerson[];
  try {
    roster = opts.orgId ? await loadNameRoster(opts.orgId) : [];
  } catch (e) {
    console.error("[ai] name roster failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The AI service isn't available right now. Please try again." };
  }
  const system = redactForModel(opts.system, roster);
  const prompt = redactForModel(opts.prompt, roster);

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
        system: system.redacted,
        messages: [
          {
            role: "user",
            content: opts.image
              ? [
                  { type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.base64 } },
                  { type: "text", text: prompt.redacted },
                ]
              : prompt.redacted,
          },
        ],
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
  // Map placeholders back to names here on the server; the model never saw the names.
  const text = prompt.restore((body?.content ?? []).filter((c) => c.type === "text" && c.text).map((c) => c.text).join("\n").trim());
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
