// IST billing periods, Indian financial years and TRIQ invoice numbers. Pure.

const IST_OFFSET_MS = 330 * 60_000; // UTC+05:30, no DST

/** IST calendar month containing `d`, as "YYYY-MM". */
export function istMonthOf(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The IST month before the one containing `d` ("YYYY-MM"). The cron bills the month just finished. */
export function previousIstMonth(d: Date): string {
  const [y, m] = istMonthOf(d).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Billing period for an IST month: start = 1st 00:00 IST, end = last instant of the month in IST
 * (next month's 1st 00:00 IST minus 1 ms). `months` > 1 for annual periods.
 */
export function istPeriod(month: string, months = 1): { periodStart: Date; periodEnd: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`Bad month "${month}" (expected YYYY-MM)`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) throw new Error(`Bad month "${month}"`);
  const periodStart = new Date(Date.UTC(y, mo, 1) - IST_OFFSET_MS);
  const next = new Date(Date.UTC(y, mo + Math.max(1, Math.floor(months)), 1) - IST_OFFSET_MS);
  return { periodStart, periodEnd: new Date(next.getTime() - 1) };
}

/** Indian financial year (April–March, IST) label: 2026-11-07 -> "FY26-27". */
export function financialYearLabel(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  const two = (n: number) => String(n % 100).padStart(2, "0");
  return `FY${two(start)}-${two(start + 1)}`;
}

export const INVOICE_PREFIX = "TRIQ";

/** "FY26-27" -> "2627", so invoice numbers stay within GST's 16-character limit. */
export function fyCode(fy: string): string {
  const m = /^FY(\d{2})-(\d{2})$/.exec(fy);
  return m ? `${m[1]}${m[2]}` : fy;
}

/**
 * "TRIQ/2627/0001" (14 characters). One series for all of TRIQ's own invoices per financial year.
 * GST rules cap a tax invoice number at 16 characters, so the year is written compactly.
 */
export function formatInvoiceNumber(fy: string, seq: number): string {
  return `${INVOICE_PREFIX}/${fyCode(fy)}/${String(Math.max(1, Math.floor(seq))).padStart(4, "0")}`;
}

/** Next number after the highest existing number in that FY (numbers from other FYs are ignored). */
export function nextInvoiceNumber(fy: string, existing: string[]): string {
  const prefix = `${INVOICE_PREFIX}/${fyCode(fy)}/`;
  let max = 0;
  for (const n of existing) {
    if (!n.startsWith(prefix)) continue;
    const seq = Number(n.slice(prefix.length));
    if (Number.isInteger(seq) && seq > max) max = seq;
  }
  return formatInvoiceNumber(fy, max + 1);
}
