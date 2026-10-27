/**
 * AI spend accounting — pure functions, no I/O.
 *
 * Prices are USD per million tokens, from the Claude pricing page (checked 2026-10-27):
 * https://platform.claude.com/docs/en/about-claude/pricing
 * Haiku 5.5 charges a higher rate when a single prompt exceeds 100,000 tokens.
 */

export type ModelPrice = {
  inPerMTok: number;
  outPerMTok: number;
  /** Prompts above this many input tokens use the long-context rates (if set). */
  longThreshold?: number;
  inLongPerMTok?: number;
  outLongPerMTok?: number;
};

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-haiku-5-5": { inPerMTok: 0.1, outPerMTok: 0.5, longThreshold: 100_000, inLongPerMTok: 0.5, outLongPerMTok: 2.5 },
  "claude-sonnet-5-5": { inPerMTok: 2, outPerMTok: 10 },
};

export const DEFAULT_AI_MODEL = "claude-haiku-5-5";

/** Cost of one call in USD. Unknown models are priced at the most expensive listed rate so the cap stays safe. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICES[model] ?? MODEL_PRICES["claude-sonnet-5-5"];
  const tokensIn = Math.max(0, inputTokens || 0);
  const tokensOut = Math.max(0, outputTokens || 0);
  const long = p.longThreshold != null && tokensIn > p.longThreshold;
  const inRate = long && p.inLongPerMTok != null ? p.inLongPerMTok : p.inPerMTok;
  const outRate = long && p.outLongPerMTok != null ? p.outLongPerMTok : p.outPerMTok;
  return (tokensIn * inRate + tokensOut * outRate) / 1_000_000;
}

/**
 * Monthly cap in USD from env. The founder sets the cap in rupees (AI_MONTHLY_BUDGET_INR, default ₹5,000)
 * and a conversion rate (AI_USD_INR_RATE). The default rate is deliberately high, so real spend stays
 * at or under the rupee cap when the actual rate is lower.
 */
export function monthlyBudgetUsd(env: Record<string, string | undefined>): number {
  const inr = Number(env.AI_MONTHLY_BUDGET_INR ?? 5000);
  const rate = Number(env.AI_USD_INR_RATE ?? 95);
  if (!Number.isFinite(inr) || inr <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return inr / rate;
}

/** First instant of the current calendar month, UTC. */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Sum the `costUsd` field of AI usage audit rows (details is a JSON string). Bad rows count as 0. */
export function sumLoggedCost(rows: ReadonlyArray<{ details: string | null }>): number {
  let total = 0;
  for (const r of rows) {
    if (!r.details) continue;
    try {
      const c = Number((JSON.parse(r.details) as { costUsd?: unknown }).costUsd);
      if (Number.isFinite(c) && c > 0) total += c;
    } catch {
      /* ignore malformed rows */
    }
  }
  return total;
}

/** Allow a call only while spend so far plus a worst-case estimate stays within the budget. */
export function withinBudget(spentUsd: number, budgetUsd: number, estimateUsd: number): boolean {
  return budgetUsd > 0 && spentUsd + estimateUsd <= budgetUsd;
}

/** AI actions left this month for an academy (never negative). */
export function aiActionsRemaining(allowance: number, usedThisMonth: number): number {
  return Math.max(0, Math.floor(allowance) - Math.max(0, Math.floor(usedThisMonth)));
}
