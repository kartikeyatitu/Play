/**
 * Weekly summary (analytics step 5) — pure. Last 7 days vs the 7 before, plus where things stand.
 * Built only from recorded numbers; no student names (it is shared on WhatsApp).
 */
import { formatCurrency } from "@/lib/currency";
import { pctChange, pointChange } from "@/lib/insights";

export type WeekFigures = { received: number; present: number; marked: number; enquiries: number; newStudents: number };
export type DigestInput = {
  academyName: string;
  currency: string;
  weekLabel: string; // e.g. "21–27 Oct"
  thisWeek: WeekFigures;
  lastWeek: WeekFigures;
  outstanding: { amount: number; count: number };
  overdue3Plus: number;
  risk: { high: number; medium: number };
};
export type DigestLine = { label: string; value: string; change: string | null };

const arrow = (v: number | null, kind: "pct" | "pts") => {
  if (v == null) return null;
  if (Math.abs(v) < 0.005) return "same as last week";
  const n = Math.round(Math.abs(v) * 100);
  return `${v > 0 ? "▲" : "▼"} ${n}${kind === "pct" ? "%" : " pts"} vs last week`;
};
const countChange = (now: number, before: number) => (now === before ? "same as last week" : `${now > before ? "▲" : "▼"} ${Math.abs(now - before)} vs last week`);

export function buildDigest(d: DigestInput): { lines: DigestLine[]; actions: string[]; text: string } {
  const m = (n: number) => formatCurrency(n, d.currency);
  const rate = (w: WeekFigures) => (w.marked > 0 ? w.present / w.marked : null);
  const lines: DigestLine[] = [
    { label: "Fees received", value: m(d.thisWeek.received), change: arrow(pctChange(d.thisWeek.received, d.lastWeek.received), "pct") },
    { label: "Attendance", value: rate(d.thisWeek) == null ? "not marked" : `${Math.round((rate(d.thisWeek) ?? 0) * 100)}%`, change: arrow(pointChange(rate(d.thisWeek), rate(d.lastWeek)), "pts") },
    { label: "New enquiries", value: String(d.thisWeek.enquiries), change: countChange(d.thisWeek.enquiries, d.lastWeek.enquiries) },
    { label: "New students", value: String(d.thisWeek.newStudents), change: countChange(d.thisWeek.newStudents, d.lastWeek.newStudents) },
    { label: "Unpaid fees", value: `${m(d.outstanding.amount)} (${d.outstanding.count})`, change: null },
  ];
  const actions: string[] = [];
  if (d.risk.high > 0) actions.push(`Call the parents of ${d.risk.high} student${d.risk.high === 1 ? "" : "s"} at high risk of dropping out.`);
  if (d.overdue3Plus > 0) actions.push(`Follow up ${d.overdue3Plus} fee${d.overdue3Plus === 1 ? "" : "s"} that are 3+ months late.`);
  if (d.thisWeek.marked === 0) actions.push("No attendance was marked this week. Ask coaches to mark sessions in the app.");
  if (actions.length === 0 && d.risk.medium > 0) actions.push(`Check in on ${d.risk.medium} student${d.risk.medium === 1 ? "" : "s"} at medium risk.`);
  if (actions.length === 0) actions.push("Nothing urgent. A good week to ask happy parents for referrals.");

  const text = [
    `*${d.academyName} — week of ${d.weekLabel}*`,
    ...lines.map((l) => `• ${l.label}: ${l.value}${l.change ? ` (${l.change})` : ""}`),
    "",
    "*This week:*",
    ...actions.map((a) => `→ ${a}`),
    "",
    "From TRIQ",
  ].join("\n");
  return { lines, actions, text };
}
