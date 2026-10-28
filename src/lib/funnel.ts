/**
 * Analytics step 3 — lead funnel by source and new-student retention cohorts. Pure, no I/O.
 *
 * Funnel: an enquiry (Lead) counts as
 *  - "had a trial" if its status is TRIAL_ATTENDED/ENROLLED, or a trial booking with the same parent phone was
 *    COMPLETED/ENROLLED on or after the enquiry date;
 *  - "enrolled" if its status is ENROLLED, or a student whose parent has the same phone was added on or after the
 *    enquiry date. (Converting a trial does not update the lead, so status alone under-counts.)
 * Phones match on their last 10 digits. Walk-ins can enrol without a trial, so the stages are not nested.
 *
 * Cohorts: students grouped by the month they were added; a student is "active" in a month if they were marked
 * present at least once that month. Students deleted from Triq are not counted.
 */
import { addMonths, lastNMonths, monthLabel, monthsBehind, type MonthKey } from "@/lib/insights";

export const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website / trial page",
  WALK_IN: "Walk-in",
  REFERRAL: "Referral",
  SOCIAL_MEDIA: "Social media",
  PHONE_CALL: "Phone call",
  WHATSAPP: "WhatsApp",
};

export function phoneKey(phone: string | null | undefined): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}

export type FunnelLead = { source: string; status: string; phone: string; createdAt: Date };
export type FunnelTrial = { phone: string; status: string; createdAt: Date };
export type FunnelStudent = { phone: string; createdAt: Date };
export type FunnelRow = { source: string; label: string; enquiries: number; trials: number; enrolled: number; trialRate: number | null; enrolRate: number | null };

export function buildFunnel(leads: ReadonlyArray<FunnelLead>, trials: ReadonlyArray<FunnelTrial>, students: ReadonlyArray<FunnelStudent>): { rows: FunnelRow[]; total: FunnelRow } {
  const doneTrials = new Map<string, Date[]>();
  for (const t of trials) {
    if (t.status !== "COMPLETED" && t.status !== "ENROLLED") continue;
    const k = phoneKey(t.phone);
    if (!k) continue;
    doneTrials.set(k, [...(doneTrials.get(k) ?? []), t.createdAt]);
  }
  const studentDates = new Map<string, Date[]>();
  for (const s of students) {
    const k = phoneKey(s.phone);
    if (!k) continue;
    studentDates.set(k, [...(studentDates.get(k) ?? []), s.createdAt]);
  }
  const after = (dates: Date[] | undefined, from: Date) => (dates ?? []).some((d) => d.getTime() >= from.getTime() - 86_400_000);

  const bySource = new Map<string, { enquiries: number; trials: number; enrolled: number }>();
  for (const l of leads) {
    const src = l.source || "WALK_IN";
    const row = bySource.get(src) ?? { enquiries: 0, trials: 0, enrolled: 0 };
    const k = phoneKey(l.phone);
    const enrolled = l.status === "ENROLLED" || (k !== "" && after(studentDates.get(k), l.createdAt));
    const trialled = l.status === "TRIAL_ATTENDED" || l.status === "ENROLLED" || (k !== "" && after(doneTrials.get(k), l.createdAt));
    row.enquiries++;
    if (trialled) row.trials++;
    if (enrolled) row.enrolled++;
    bySource.set(src, row);
  }
  const toRow = (source: string, r: { enquiries: number; trials: number; enrolled: number }): FunnelRow => ({
    source,
    label: SOURCE_LABELS[source] ?? source.replace(/_/g, " ").toLowerCase(),
    ...r,
    trialRate: r.enquiries > 0 ? r.trials / r.enquiries : null,
    enrolRate: r.enquiries > 0 ? r.enrolled / r.enquiries : null,
  });
  const rows = [...bySource.entries()].map(([s, r]) => toRow(s, r)).sort((a, b) => b.enquiries - a.enquiries || a.label.localeCompare(b.label));
  const sum = rows.reduce((acc, r) => ({ enquiries: acc.enquiries + r.enquiries, trials: acc.trials + r.trials, enrolled: acc.enrolled + r.enrolled }), { enquiries: 0, trials: 0, enrolled: 0 });
  return { rows, total: toRow("ALL", sum) };
}

export type CohortRow = { month: MonthKey; label: string; size: number; retention: (number | null)[] };

/**
 * Retention triangle for the last `count` join months. retention[k] = share of the cohort active in month (join + k);
 * null when that month hasn't happened yet.
 */
export function buildCohorts(
  students: ReadonlyArray<{ id: string; joinedMonth: MonthKey }>,
  activeMonths: ReadonlyMap<string, ReadonlySet<MonthKey>>,
  currentMonth: MonthKey,
  count = 6,
): CohortRow[] {
  const months = lastNMonths(currentMonth, count);
  return months.map((m) => {
    const members = students.filter((s) => s.joinedMonth === m);
    const span = monthsBehind(m, currentMonth);
    const retention = Array.from({ length: count }, (_, k) => {
      if (k > span) return null;
      if (members.length === 0) return null;
      const target = addMonths(m, k);
      const active = members.filter((s) => activeMonths.get(s.id)?.has(target)).length;
      return active / members.length;
    });
    return { month: m, label: monthLabel(m), size: members.length, retention };
  });
}

