/**
 * "Ask TRIQ" (analytics step 4) — pure helpers. The AI only maps a question to one approved report and a month;
 * TRIQ runs that report on the academy's own data and renders the numbers. The AI never produces figures or SQL.
 */
import { isMonthKey, monthLabel, type MonthKey } from "@/lib/insights";

export const ASK_INTENTS = {
  outstanding_fees: "How much fee money is unpaid, grouped by how many months late, and which students owe the most.",
  unpaid_by_batch: "Unpaid (outstanding) fees and collections for each batch in a given month.",
  collections_trend: "Fees billed, collected and received each month over the last 12 months.",
  attendance_by_batch: "Attendance rate and sessions for each batch in a given month.",
  batch_fill: "How full each batch is: students enrolled versus capacity.",
  at_risk_students: "Students who may drop out (poor or falling attendance, missed sessions in a row, unpaid fees).",
  enquiry_sources: "Where enquiries come from and how many enrolled, by source, over the last 6 months.",
  retention: "Whether new students keep coming in the months after they join (retention by join month).",
  today_snapshot: "Today at a glance: fees received today and yesterday, sessions, trials and new enquiries.",
  new_students: "How many new students joined each month over the last 12 months.",
} as const;
export type AskIntent = keyof typeof ASK_INTENTS;

export const ASK_EXAMPLES = [
  "Who owes the most fees?",
  "Which batch has the most unpaid fees this month?",
  "Which students might drop out?",
  "Where do our best enquiries come from?",
  "How full are my batches?",
  "How did collections go over the last year?",
];

export function askSystemPrompt(currentMonth: MonthKey): string {
  const list = Object.entries(ASK_INTENTS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  return [
    "You route a sports academy owner's question to exactly one report. You never answer the question yourself.",
    `The current month is ${currentMonth}. Reports:`,
    list,
    'Reply with JSON only: {"intent":"<one key above or unsupported>","month":"YYYY-MM or null"}.',
    "Use month only for unpaid_by_batch and attendance_by_batch; resolve words like 'this month' or 'last month' relative to the current month. Never pick a future month.",
    'If no report fits, or the question asks for anything else (personal details, other academies, advice, actions), use "unsupported".',
  ].join("\n");
}

export type AskRoute = { intent: AskIntent; month: MonthKey } | { intent: "unsupported" };

/** Validate the AI's routing reply. Anything unexpected becomes "unsupported". */
export function parseAskRoute(text: string, currentMonth: MonthKey): AskRoute {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { intent: "unsupported" };
  let obj: { intent?: unknown; month?: unknown };
  try {
    obj = JSON.parse(match[0]);
  } catch {
    return { intent: "unsupported" };
  }
  const intent = typeof obj.intent === "string" ? obj.intent : "";
  // Own keys only: `in` would also accept inherited names such as "__proto__" or "toString".
  if (!Object.prototype.hasOwnProperty.call(ASK_INTENTS, intent)) return { intent: "unsupported" };
  const month = isMonthKey(obj.month) && obj.month <= currentMonth ? obj.month : currentMonth;
  return { intent: intent as AskIntent, month };
}

/** A rendered answer: always TRIQ's own numbers. */
export type AskAnswer = {
  title: string;
  summary: string;
  columns: string[];
  rows: (string | number)[][];
  /** Right-align these column indexes (numbers). */
  numeric: number[];
  note?: string;
};

export function intentTitle(route: AskRoute & { intent: AskIntent }): string {
  switch (route.intent) {
    case "unpaid_by_batch":
      return `Unpaid fees by batch · ${monthLabel(route.month)}`;
    case "attendance_by_batch":
      return `Attendance by batch · ${monthLabel(route.month)}`;
    case "outstanding_fees":
      return "Unpaid fees";
    case "collections_trend":
      return "Fees over the last 12 months";
    case "batch_fill":
      return "How full each batch is";
    case "at_risk_students":
      return "Students who may drop out";
    case "enquiry_sources":
      return "Where enquiries come from · last 6 months";
    case "retention":
      return "Do new students keep coming?";
    case "today_snapshot":
      return "Today at a glance";
    case "new_students":
      return "New students per month";
  }
}
