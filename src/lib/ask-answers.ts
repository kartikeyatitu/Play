/**
 * Ask TRIQ answer builders — pure. Each takes the output of an existing, tested loader and turns it into a table.
 * Every number shown comes from these inputs; nothing here comes from the AI.
 */
import type { AskAnswer } from "@/lib/ask";
import type { BusinessReport } from "@/lib/business-report";
import type { OwnerInsights } from "@/lib/insights-data";
import type { AtRiskSummary } from "@/lib/risk-data";
import type { FunnelAndCohorts } from "@/lib/funnel-data";
import { formatCurrency } from "@/lib/currency";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export function answerOutstanding(
  title: string,
  insights: OwnerInsights,
  topOwing: { name: string; amount: number; months: number }[],
): AskAnswer {
  const m = (n: number) => formatCurrency(n, insights.currency);
  const s = insights.snapshot.outstanding;
  return {
    title,
    summary: s.count === 0 ? "No unpaid fees. Everything recorded is paid." : `${m(s.amount)} unpaid across ${s.count} fee records.`,
    columns: ["Who / when", "Unpaid", "Records"],
    numeric: [1, 2],
    rows: [
      ...insights.ageing.map((b) => [b.label, m(b.amount), b.count]),
      ...topOwing.map((t) => [t.name, m(t.amount), `${t.months} month${t.months === 1 ? "" : "s"}`]),
    ],
    note: topOwing.length > 0 ? "First rows: by how late. Then the students who owe the most." : undefined,
  };
}

export function answerBatches(title: string, kind: "unpaid" | "attendance" | "fill", report: BusinessReport, currency: string): AskAnswer {
  const m = (n: number) => formatCurrency(n, currency);
  const rows = report.batches.rows;
  if (kind === "unpaid") {
    const sorted = [...rows].sort((a, b) => b.outstanding - a.outstanding);
    const top = sorted[0];
    return {
      title,
      summary: top && top.outstanding > 0 ? `${top.name} has the most unpaid: ${m(top.outstanding)}.` : "No unpaid fees in this month's batches.",
      columns: ["Batch", "Billed", "Collected", "Unpaid"],
      numeric: [1, 2, 3],
      rows: sorted.map((b) => [b.name, m(b.billed), m(b.collected), m(b.outstanding)]),
    };
  }
  if (kind === "attendance") {
    const sorted = [...rows].sort((a, b) => (a.attendanceRate ?? 2) - (b.attendanceRate ?? 2));
    const low = sorted.find((b) => b.attendanceRate != null);
    return {
      title,
      summary: low ? `Lowest attendance: ${low.name} at ${pct(low.attendanceRate)}. Academy overall: ${pct(report.attendance.rate)}.` : "No attendance was marked this month.",
      columns: ["Batch", "Attendance", "Present / marked", "Sessions"],
      numeric: [1, 2, 3],
      rows: sorted.map((b) => [b.name, pct(b.attendanceRate), `${b.present}/${b.marked}`, b.sessions]),
    };
  }
  const sorted = [...rows].sort((a, b) => (b.utilisation ?? -1) - (a.utilisation ?? -1));
  return {
    title,
    summary:
      report.batches.capacity > 0
        ? `Overall ${pct(report.batches.utilisation)} full: ${report.batches.enrolled} enrolled for ${report.batches.capacity} places.`
        : "No batch has a capacity set, so fill can't be worked out. Add capacities in Batches.",
    columns: ["Batch", "Enrolled", "Capacity", "Full"],
    numeric: [1, 2, 3],
    rows: sorted.map((b) => [b.name, b.enrolled, b.capacity ?? "—", pct(b.utilisation)]),
  };
}

export function answerTrend(title: string, kind: "collections" | "new_students", insights: OwnerInsights): AskAnswer {
  const m = (n: number) => formatCurrency(n, insights.currency);
  const rows = [...insights.trends].reverse();
  if (kind === "new_students") {
    const total = insights.trends.reduce((s, t) => s + t.newStudents, 0);
    return { title, summary: `${total} new students in the last 12 months.`, columns: ["Month", "New students"], numeric: [1], rows: rows.map((t) => [t.label, t.newStudents]) };
  }
  const collected = insights.trends.reduce((s, t) => s + t.collected, 0);
  const billed = insights.trends.reduce((s, t) => s + t.billed, 0);
  return {
    title,
    summary: `${m(collected)} collected of ${m(billed)} billed over 12 months (${pct(billed > 0 ? collected / billed : null)}).`,
    columns: ["Month", "Billed", "Collected", "Rate", "Received"],
    numeric: [1, 2, 3, 4],
    rows: rows.map((t) => [t.label, m(t.billed), m(t.collected), pct(t.collectionRate), m(t.received)]),
    note: "Received = payments that arrived that month, for any month's fee.",
  };
}

export function answerToday(title: string, insights: OwnerInsights): AskAnswer {
  const m = (n: number) => formatCurrency(n, insights.currency);
  const s = insights.snapshot;
  return {
    title,
    summary: `${m(s.receivedToday.amount)} received today; ${s.sessionsToday} sessions, ${s.sessionsMarkedToday} marked.`,
    columns: ["", "Today", "Yesterday"],
    numeric: [1, 2],
    rows: [
      ["Fees received", m(s.receivedToday.amount), m(s.receivedYesterday.amount)],
      ["Payments", s.receivedToday.count, s.receivedYesterday.count],
      ["New enquiries", s.enquiriesToday, s.enquiriesYesterday],
      ["Sessions", s.sessionsToday, "—"],
      ["Trials", s.trialsToday, "—"],
    ],
  };
}

export function answerAtRisk(title: string, risk: AtRiskSummary): AskAnswer {
  const shown = risk.students.filter((s) => s.level !== "low").slice(0, 25);
  return {
    title,
    summary: shown.length === 0 ? "No one is at high or medium risk right now." : `${risk.high} high and ${risk.medium} medium risk, of ${risk.checked} enrolled.`,
    columns: ["Student", "Risk", "Why"],
    numeric: [],
    rows: shown.map((s) => [s.name, s.level === "high" ? "High" : "Medium", s.reasons.join("; ")]),
    note: "Open Analytics for WhatsApp messages to parents.",
  };
}

export function answerSources(title: string, f: FunnelAndCohorts): AskAnswer {
  const best = [...f.funnel.rows].filter((r) => r.enquiries >= 3).sort((a, b) => (b.enrolRate ?? 0) - (a.enrolRate ?? 0))[0];
  return {
    title,
    summary:
      f.funnel.total.enquiries === 0
        ? "No enquiries recorded in the last 6 months."
        : best
          ? `${best.label} converts best: ${pct(best.enrolRate)} of ${best.enquiries} enquiries enrolled.`
          : `${f.funnel.total.enquiries} enquiries, ${f.funnel.total.enrolled} enrolled.`,
    columns: ["Source", "Enquiries", "Had a trial", "Enrolled", "Conversion"],
    numeric: [1, 2, 3, 4],
    rows: [...f.funnel.rows, f.funnel.total].map((r) => [r.source === "ALL" ? "All sources" : r.label, r.enquiries, r.trials, r.enrolled, pct(r.enrolRate)]),
  };
}

export function answerRetention(title: string, f: FunnelAndCohorts): AskAnswer {
  const cols = f.cohorts.length;
  const withOneMonth = f.cohorts.filter((c) => c.size > 0 && c.retention[1] != null);
  const avg1 = withOneMonth.length ? withOneMonth.reduce((s, c) => s + (c.retention[1] ?? 0), 0) / withOneMonth.length : null;
  return {
    title,
    summary: avg1 == null ? "Not enough history yet: students need a full month after joining." : `On average ${pct(avg1)} of new students are still attending the month after they join.`,
    columns: ["Joined", "Students", ...Array.from({ length: cols }, (_, k) => (k === 0 ? "Same month" : `+${k} mo`))],
    numeric: Array.from({ length: cols + 1 }, (_, i) => i + 1),
    rows: f.cohorts.map((c) => [c.label, c.size, ...c.retention.map((r) => (r == null ? "" : pct(r)))]),
  };
}
