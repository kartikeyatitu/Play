/**
 * V1 Business — monthly business report (pure, no DB). Metric definitions (also in docs/specs/01-triq-business.md §7):
 *
 *  - billed            Σ amount of every fee record whose fee month = M
 *  - collected         Σ amount of PAID fee records whose fee month = M
 *  - outstandingMonth  billed − collected (includes PENDING and PENDING_VERIFICATION)
 *  - outstandingAll    Σ non-PAID fee records with fee month ≤ M (computed by the caller with one aggregate)
 *  - collectionRate    collected / billed
 *  - attendanceRate    present / marked attendance rows, in non-cancelled sessions dated in M
 *  - batch utilisation enrolled / capacity, only batches that have a capacity
 *  - court utilisation booked hours / open hours; booked = CONFIRMED, COMPLETED or NO_SHOW bookings starting in M
 *                      (batch allocations included, they occupy the court); open = (close − open hour) × days in M
 *  - courtRevenue      Σ advancePaid (money actually received) of CONFIRMED/COMPLETED/NO_SHOW public bookings in M
 *
 * Rates are null when their denominator is 0 — never estimated. Fee money is attributed to a batch through the
 * student's earliest enrolment (students without an enrolment are "unassigned").
 */

export const BUSINESS_REPORT_DISABLED_ERROR = "The business report is not enabled for this academy yet.";
export const COUNTED_BOOKING_STATUSES = ["CONFIRMED", "COMPLETED", "NO_SHOW"] as const;

export type ReportFee = { amount: number; status: string; batchId: string | null };
export type ReportBatch = { id: string; name: string; capacity: number | null; enrolled: number };
export type ReportSession = { batchId: string; status: string; marked: number; present: number };
export type ReportTrial = { status: string };
export type ReportFacility = { id: string; name: string; openHour: number; closeHour: number };
export type ReportBooking = { facilityId: string; hours: number; status: string; advancePaid: number; isAllocation: boolean };

export type ReportInput = {
  month: string;
  daysInMonth: number;
  fees: ReportFee[];
  outstandingAll: { amount: number; count: number };
  batches: ReportBatch[];
  sessions: ReportSession[];
  students: { active: number; newInMonth: number };
  trials: ReportTrial[];
  facilities: ReportFacility[];
  bookings: ReportBooking[];
};

export type BatchRow = {
  id: string;
  name: string;
  enrolled: number;
  capacity: number | null;
  utilisation: number | null;
  sessions: number;
  cancelled: number;
  present: number;
  marked: number;
  attendanceRate: number | null;
  billed: number;
  collected: number;
  outstanding: number;
};

export type FacilityRow = {
  id: string;
  name: string;
  openHours: number;
  bookedHours: number;
  allocationHours: number;
  utilisation: number | null;
  revenue: number;
};

export type BusinessReport = {
  month: string;
  money: { billed: number; collected: number; outstandingMonth: number; outstandingAll: number; outstandingAllCount: number; collectionRate: number | null; feeRecords: number };
  attendance: { present: number; marked: number; rate: number | null; sessions: number; cancelled: number };
  students: { active: number; newInMonth: number };
  trials: { booked: number; enrolled: number; conversionRate: number | null };
  batches: { rows: BatchRow[]; enrolled: number; capacity: number; utilisation: number | null };
  facilities: { rows: FacilityRow[]; openHours: number; bookedHours: number; utilisation: number | null; revenue: number };
};

/** Round money to 2 decimals (FeeRecord.amount is a Float). */
export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

/** Valid, non-future YYYY-MM. */
export function isReportMonth(month: unknown, currentMonth: string): month is string {
  return typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= currentMonth;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** [first day of M, first day of M+1) as UTC midnights (how sessions/trials store calendar days). */
export function monthBounds(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

/** The batch a student's money is attributed to: their earliest enrolment. */
export function attributedBatchId(enrollments: ReadonlyArray<{ batchId: string; joinedAt: Date | string }>): string | null {
  if (enrollments.length === 0) return null;
  let best = enrollments[0];
  for (const e of enrollments) if (new Date(e.joinedAt).getTime() < new Date(best.joinedAt).getTime()) best = e;
  return best.batchId;
}

export function computeBusinessReport(input: ReportInput): BusinessReport {
  const billed = input.fees.reduce((s, f) => s + f.amount, 0);
  const collected = input.fees.filter((f) => f.status === "PAID").reduce((s, f) => s + f.amount, 0);

  const live = input.sessions.filter((s) => s.status !== "CANCELLED");
  const present = live.reduce((n, s) => n + s.present, 0);
  const marked = live.reduce((n, s) => n + s.marked, 0);

  const batchRows: BatchRow[] = input.batches.map((b) => {
    const ss = input.sessions.filter((s) => s.batchId === b.id);
    const ls = ss.filter((s) => s.status !== "CANCELLED");
    const fees = input.fees.filter((f) => f.batchId === b.id);
    const bBilled = fees.reduce((s, f) => s + f.amount, 0);
    const bCollected = fees.filter((f) => f.status === "PAID").reduce((s, f) => s + f.amount, 0);
    const bPresent = ls.reduce((n, s) => n + s.present, 0);
    const bMarked = ls.reduce((n, s) => n + s.marked, 0);
    return {
      id: b.id,
      name: b.name,
      enrolled: b.enrolled,
      capacity: b.capacity,
      utilisation: b.capacity ? ratio(b.enrolled, b.capacity) : null,
      sessions: ls.length,
      cancelled: ss.length - ls.length,
      present: bPresent,
      marked: bMarked,
      attendanceRate: ratio(bPresent, bMarked),
      billed: money(bBilled),
      collected: money(bCollected),
      outstanding: money(bBilled - bCollected),
    };
  });
  const withCap = input.batches.filter((b) => b.capacity && b.capacity > 0);
  const capEnrolled = withCap.reduce((n, b) => n + b.enrolled, 0);
  const capacity = withCap.reduce((n, b) => n + (b.capacity as number), 0);

  const counted = new Set<string>(COUNTED_BOOKING_STATUSES);
  const facilityRows: FacilityRow[] = input.facilities.map((f) => {
    const bs = input.bookings.filter((b) => b.facilityId === f.id && counted.has(b.status));
    const openHours = Math.max(0, f.closeHour - f.openHour) * input.daysInMonth;
    const bookedHours = bs.reduce((n, b) => n + b.hours, 0);
    return {
      id: f.id,
      name: f.name,
      openHours,
      bookedHours,
      allocationHours: bs.filter((b) => b.isAllocation).reduce((n, b) => n + b.hours, 0),
      utilisation: ratio(bookedHours, openHours),
      revenue: bs.filter((b) => !b.isAllocation).reduce((n, b) => n + b.advancePaid, 0),
    };
  });
  const openHours = facilityRows.reduce((n, f) => n + f.openHours, 0);
  const bookedHours = facilityRows.reduce((n, f) => n + f.bookedHours, 0);

  const enrolledTrials = input.trials.filter((t) => t.status === "ENROLLED").length;

  return {
    month: input.month,
    money: {
      billed: money(billed),
      collected: money(collected),
      outstandingMonth: money(billed - collected),
      outstandingAll: money(input.outstandingAll.amount),
      outstandingAllCount: input.outstandingAll.count,
      collectionRate: ratio(collected, billed),
      feeRecords: input.fees.length,
    },
    attendance: { present, marked, rate: ratio(present, marked), sessions: live.length, cancelled: input.sessions.length - live.length },
    students: input.students,
    trials: { booked: input.trials.length, enrolled: enrolledTrials, conversionRate: ratio(enrolledTrials, input.trials.length) },
    batches: { rows: batchRows, enrolled: input.batches.reduce((n, b) => n + b.enrolled, 0), capacity, utilisation: ratio(capEnrolled, capacity) },
    facilities: { rows: facilityRows, openHours, bookedHours, utilisation: ratio(bookedHours, openHours), revenue: facilityRows.reduce((n, f) => n + f.revenue, 0) },
  };
}

/** Whole hours between two instants (court bookings are whole-hour slots). */
export function bookingHours(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 3_600_000));
}

/** "73%" or "—" when the rate is unknown. */
export function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}
