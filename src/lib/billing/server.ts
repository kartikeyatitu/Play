// TRIQ's own billing — DB side. Server-only. Creates DRAFT SubscriptionInvoice rows only: nothing
// here charges, issues or sends an invoice. Every path is a no-op while FEATURES.triqBilling is off.

import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { FOUNDING_OFFER } from "@/lib/pricing";
import { calculateTriqBill, type TriqBill } from "./calc";
import { financialYearLabel, INVOICE_PREFIX, istPeriod, nextInvoiceNumber } from "./periods";

/** Active student = enrolled in at least one batch during the period (joined on or before its end). */
export async function countActiveStudents(orgId: string, periodEnd: Date): Promise<number> {
  return db.student.count({ where: { orgId, enrollments: { some: { joinedAt: { lte: periodEnd } } } } });
}

/**
 * Founding offer: the first FOUNDING_OFFER.slots academies by signup date, for FOUNDING_OFFER.months
 * months from signup. CONFIRM: there is no "founding" column, so the first 50 by Organization.createdAt
 * (including inactive/test academies) are treated as founding. Replace with an explicit list if needed.
 */
export async function foundingStatus(org: { id: string; createdAt: Date }, periodStart: Date): Promise<{ founding: boolean; monthsRemaining: number }> {
  const earlier = await db.organization.count({ where: { createdAt: { lt: org.createdAt } } });
  if (earlier >= FOUNDING_OFFER.slots) return { founding: false, monthsRemaining: 0 };
  const ends = new Date(org.createdAt);
  ends.setUTCMonth(ends.getUTCMonth() + FOUNDING_OFFER.months);
  if (periodStart.getTime() >= ends.getTime()) return { founding: false, monthsRemaining: 0 };
  const months = (ends.getUTCFullYear() - periodStart.getUTCFullYear()) * 12 + (ends.getUTCMonth() - periodStart.getUTCMonth());
  return { founding: true, monthsRemaining: Math.max(1, Math.min(FOUNDING_OFFER.months, months)) };
}

export interface OrgBillPreview {
  bill: TriqBill;
  periodStart: Date;
  periodEnd: Date;
  founding: boolean;
}

export async function previewOrgBill(orgId: string, month: string, cycle: "MONTHLY" | "ANNUAL" = "MONTHLY"): Promise<OrgBillPreview | null> {
  if (!FEATURES.triqBilling) return null;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { id: true, createdAt: true, state: true, country: true } });
  if (!org) return null;
  const { periodStart, periodEnd } = istPeriod(month);
  const [activeStudents, f] = await Promise.all([countActiveStudents(orgId, periodEnd), foundingStatus(org, periodStart)]);
  const bill = calculateTriqBill({
    activeStudents,
    country: org.country,
    orgState: org.state,
    founding: f.founding,
    foundingMonthsRemaining: f.monthsRemaining,
    cycle,
  });
  return { bill, periodStart, periodEnd, founding: f.founding };
}

interface DraftInvoiceData {
  orgId: string;
  subscriptionId: string | null;
  periodStart: Date;
  periodEnd: Date;
  activeStudents: number;
  amountPaise: number;
  gstPaise: number;
  currency: string;
  status: "DRAFT";
}

async function createWithNextNumber(data: DraftInvoiceData, now: Date) {
  const fy = financialYearLabel(now);
  for (let tries = 0; tries < 5; tries++) {
    const existing = await db.subscriptionInvoice.findMany({
      where: { invoiceNumber: { startsWith: `${INVOICE_PREFIX}/${fy}/` } },
      select: { invoiceNumber: true },
    });
    const invoiceNumber = nextInvoiceNumber(fy, existing.map((e) => e.invoiceNumber));
    try {
      return await db.subscriptionInvoice.create({ data: { ...data, invoiceNumber }, select: { id: true, invoiceNumber: true } });
    } catch (e: any) {
      const target = String(e?.meta?.target ?? "");
      if (e?.code === "P2002" && target.includes("invoiceNumber")) continue; // number taken concurrently
      throw e;
    }
  }
  throw new Error("Could not allocate an invoice number");
}

/**
 * DRAFT invoices for every active academy for one IST month. Idempotent: an org that already has an
 * invoice for that periodStart is skipped (unique orgId+periodStart). Free-tier academies get none.
 */
export async function createDraftInvoicesForMonth(month: string, now: Date = new Date()) {
  const summary = { month, orgs: 0, created: 0, skippedFree: 0, skippedExisting: 0, errors: 0 };
  if (!FEATURES.triqBilling) return { ...summary, skipped: "triqBilling flag is off" as const };

  const { periodStart, periodEnd } = istPeriod(month);
  const orgs = await db.organization.findMany({ where: { isActive: true }, select: { id: true } });
  summary.orgs = orgs.length;
  for (const org of orgs) {
    try {
      const already = await db.subscriptionInvoice.findUnique({ where: { orgId_periodStart: { orgId: org.id, periodStart } }, select: { id: true } });
      if (already) {
        summary.skippedExisting++;
        continue;
      }
      const p = await previewOrgBill(org.id, month);
      if (!p || !p.bill.billable) {
        summary.skippedFree++;
        continue;
      }
      const sub = await db.subscription.findUnique({ where: { orgId: org.id }, select: { id: true } });
      await createWithNextNumber(
        {
          orgId: org.id,
          subscriptionId: sub?.id ?? null,
          periodStart,
          periodEnd,
          activeStudents: p.bill.activeStudents,
          amountPaise: p.bill.taxableMinor,
          gstPaise: p.bill.taxMinor,
          currency: p.bill.currency,
          status: "DRAFT",
        },
        now,
      );
      summary.created++;
    } catch (e: any) {
      if (e?.code === "P2002") {
        summary.skippedExisting++;
        continue;
      }
      summary.errors++;
      console.error("triq-billing: org failed", org.id, e instanceof Error ? e.message : e);
    }
  }
  return summary;
}
