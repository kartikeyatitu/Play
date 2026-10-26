import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { orgToday } from "@/lib/i18n";
import {
  computeTax,
  creditNoteSourceKey,
  financialYear,
  formatDocNumber,
  invoiceSourceKey,
  isValidStateCode,
  placeOfSupply as resolvePlaceOfSupply,
  toMinor,
  type PriceMode,
  type TaxDocKind,
} from "@/lib/gst";

/**
 * Server-only GST invoice service (flag `gstInvoices`). Callers check the flag and permissions; this module owns
 * numbering and the money math persistence.
 *
 * Gap-free numbering: the per-(org, FY, series) counter row is incremented with INSERT … ON CONFLICT DO UPDATE …
 * RETURNING inside the SAME transaction that inserts the document. Postgres holds the row lock until commit, so
 * concurrent issuers serialise, and a rolled-back transaction gives its number back.
 */

export type GstResult<T> = { ok: true; value: T; existed?: boolean } | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

async function nextSeq(tx: Tx, orgId: string, fy: string, series: TaxDocKind): Promise<number> {
  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    INSERT INTO "TaxDocumentCounter" ("orgId", "fy", "series", "lastSeq", "updatedAt")
    VALUES (${orgId}, ${fy}, ${series}, 1, NOW())
    ON CONFLICT ("orgId", "fy", "series")
    DO UPDATE SET "lastSeq" = "TaxDocumentCounter"."lastSeq" + 1, "updatedAt" = NOW()
    RETURNING "lastSeq"`;
  const seq = Number(rows[0]?.lastSeq);
  if (!Number.isInteger(seq) || seq < 1) throw new Error("Invoice counter failed");
  return seq;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Issue (or return the existing) tax invoice for a PAID fee record of this academy. */
export async function issueInvoiceForFee(a: {
  orgId: string;
  feeRecordId: string;
  userId: string;
  placeOfSupply?: string | null;
}): Promise<GstResult<{ id: string; number: string }>> {
  const profile = await db.orgTaxProfile.findUnique({ where: { orgId: a.orgId } });
  if (!profile) return { ok: false, error: "Add your GST details in Settings first." };
  if (a.placeOfSupply && !isValidStateCode(a.placeOfSupply)) return { ok: false, error: "Pick a valid place of supply." };

  const fee = await db.feeRecord.findUnique({
    where: { id: a.feeRecordId },
    select: {
      id: true,
      orgId: true,
      status: true,
      amount: true,
      month: true,
      paidAt: true,
      student: {
        select: {
          id: true,
          name: true,
          orgId: true,
          parent: { select: { name: true, phone: true } },
          enrollments: { select: { batch: { select: { name: true, sport: true } } }, take: 1 },
        },
      },
    },
  });
  if (!fee || (fee.student.orgId ?? fee.orgId) !== a.orgId) return { ok: false, error: "Fee record not found in your academy." };
  if (fee.status !== "PAID") return { ok: false, error: "Invoices can only be issued for paid fees." };
  if (!(fee.amount > 0)) return { ok: false, error: "This fee has no amount." };

  const sourceKey = invoiceSourceKey(fee.id, fee.paidAt);
  const existing = await db.taxInvoice.findUnique({ where: { orgId_sourceKey: { orgId: a.orgId, sourceKey } }, select: { id: true, number: true } });
  if (existing) return { ok: true, value: existing, existed: true };

  const org = await db.organization.findUnique({ where: { id: a.orgId }, select: { timezone: true } });
  const issueDay = orgToday(org);
  const fy = financialYear(issueDay);
  const pos = resolvePlaceOfSupply(profile.stateCode, a.placeOfSupply);
  const amountMinor = toMinor(fee.amount);
  const tax = computeTax({ amountMinor, rateBps: profile.rateBps, priceMode: profile.priceMode as PriceMode, supplierState: profile.stateCode, placeOfSupply: pos });
  const batch = fee.student.enrollments[0]?.batch;
  const description = `${batch?.sport ? `${batch.sport} coaching` : "Coaching"} fee — ${monthLabel(fee.month)}${batch?.name ? ` (${batch.name})` : ""}`;

  try {
    const created = await db.$transaction(async (tx) => {
      // Lock the fee row: a concurrent reversal or a second issuer waits here.
      await tx.$queryRaw`SELECT "id" FROM "FeeRecord" WHERE "id" = ${fee.id} FOR UPDATE`;
      const fresh = await tx.feeRecord.findUnique({ where: { id: fee.id }, select: { status: true, paidAt: true } });
      if (fresh?.status !== "PAID" || invoiceSourceKey(fee.id, fresh.paidAt) !== sourceKey) {
        throw new GstAbort("The fee changed while issuing the invoice. Please refresh and try again.");
      }
      // A live (not credited) invoice for this fee already exists → return it.
      const live = await tx.taxInvoice.findFirst({ where: { orgId: a.orgId, feeRecordId: fee.id, kind: "INVOICE" }, orderBy: { createdAt: "desc" }, select: { id: true, number: true } });
      if (live) {
        const credited = await tx.taxInvoice.findFirst({ where: { orgId: a.orgId, originalInvoiceId: live.id, kind: "CREDIT_NOTE" }, select: { id: true } });
        if (!credited) return { ...live, existed: true };
      }
      const seq = await nextSeq(tx, a.orgId, fy.label, "INVOICE");
      const number = formatDocNumber(profile.invoicePrefix, fy.short, seq);
      const inv = await tx.taxInvoice.create({
        data: {
          orgId: a.orgId,
          kind: "INVOICE",
          number,
          fy: fy.label,
          seq,
          sourceKey,
          issueDay,
          feeRecordId: fee.id,
          studentId: fee.student.id,
          supplierLegalName: profile.legalName,
          supplierGstin: profile.gstin,
          supplierStateCode: profile.stateCode,
          supplierAddress: profile.address,
          recipientName: fee.student.parent?.name || fee.student.name,
          recipientPhone: fee.student.parent?.phone ?? null,
          studentName: fee.student.name,
          description,
          placeOfSupply: pos,
          sacCode: profile.sacCode,
          rateBps: profile.rateBps,
          priceMode: profile.priceMode,
          taxableMinor: tax.taxableMinor,
          cgstMinor: tax.cgstMinor,
          sgstMinor: tax.sgstMinor,
          igstMinor: tax.igstMinor,
          roundOffMinor: tax.roundOffMinor,
          totalMinor: tax.totalMinor,
          amountReceivedMinor: amountMinor,
          paidAt: fresh.paidAt,
          createdById: a.userId,
        },
        select: { id: true, number: true },
      });
      await tx.auditLog.create({
        data: {
          userId: a.userId,
          orgId: a.orgId,
          action: "GST_INVOICE_ISSUED",
          details: JSON.stringify({ invoiceId: inv.id, number, feeRecordId: fee.id, totalMinor: tax.totalMinor, placeOfSupply: pos }),
        },
      });
      return { ...inv, existed: false };
    });
    const { existed, ...value } = created;
    return { ok: true, value, existed };
  } catch (e) {
    if (e instanceof GstAbort) return { ok: false, error: e.message };
    if (isUniqueViolation(e)) {
      const again = await db.taxInvoice.findUnique({ where: { orgId_sourceKey: { orgId: a.orgId, sourceKey } }, select: { id: true, number: true } });
      if (again) return { ok: true, value: again, existed: true };
    }
    if (e instanceof Error && /16-character/.test(e.message)) return { ok: false, error: "Invoice number would exceed 16 characters — shorten the prefix." };
    throw e;
  }
}

class GstAbort extends Error {}

/** Issue (or return the existing) full-value credit note against one of this academy's invoices. */
export async function issueCreditNote(a: {
  orgId: string;
  invoiceId: string;
  userId: string;
  reason: string;
}): Promise<GstResult<{ id: string; number: string }>> {
  const reason = String(a.reason || "").trim().slice(0, 300);
  if (reason.length < 3) return { ok: false, error: "Give a reason for the credit note." };
  const inv = await db.taxInvoice.findFirst({ where: { id: a.invoiceId, orgId: a.orgId, kind: "INVOICE" } });
  if (!inv) return { ok: false, error: "Invoice not found in your academy." };
  const profile = await db.orgTaxProfile.findUnique({ where: { orgId: a.orgId }, select: { creditNotePrefix: true } });
  const prefix = profile?.creditNotePrefix || "CN";
  const sourceKey = creditNoteSourceKey(inv.id);
  const existing = await db.taxInvoice.findUnique({ where: { orgId_sourceKey: { orgId: a.orgId, sourceKey } }, select: { id: true, number: true } });
  if (existing) return { ok: true, value: existing, existed: true };

  const org = await db.organization.findUnique({ where: { id: a.orgId }, select: { timezone: true } });
  const issueDay = orgToday(org);
  const fy = financialYear(issueDay);
  try {
    const cn = await db.$transaction(async (tx) => {
      const seq = await nextSeq(tx, a.orgId, fy.label, "CREDIT_NOTE");
      const number = formatDocNumber(prefix, fy.short, seq);
      const row = await tx.taxInvoice.create({
        data: {
          orgId: a.orgId,
          kind: "CREDIT_NOTE",
          number,
          fy: fy.label,
          seq,
          sourceKey,
          issueDay,
          feeRecordId: inv.feeRecordId,
          studentId: inv.studentId,
          originalInvoiceId: inv.id,
          supplierLegalName: inv.supplierLegalName,
          supplierGstin: inv.supplierGstin,
          supplierStateCode: inv.supplierStateCode,
          supplierAddress: inv.supplierAddress,
          recipientName: inv.recipientName,
          recipientPhone: inv.recipientPhone,
          studentName: inv.studentName,
          description: `Reversal of invoice ${inv.number}: ${inv.description}`.slice(0, 300),
          placeOfSupply: inv.placeOfSupply,
          sacCode: inv.sacCode,
          rateBps: inv.rateBps,
          priceMode: inv.priceMode,
          // Stored as positive values; kind = CREDIT_NOTE carries the direction (see creditNoteBreakup for net totals).
          taxableMinor: inv.taxableMinor,
          cgstMinor: inv.cgstMinor,
          sgstMinor: inv.sgstMinor,
          igstMinor: inv.igstMinor,
          roundOffMinor: inv.roundOffMinor,
          totalMinor: inv.totalMinor,
          amountReceivedMinor: 0,
          currency: inv.currency,
          paidAt: inv.paidAt,
          reason,
          createdById: a.userId,
        },
        select: { id: true, number: true },
      });
      await tx.auditLog.create({
        data: {
          userId: a.userId,
          orgId: a.orgId,
          action: "GST_CREDIT_NOTE_ISSUED",
          details: JSON.stringify({ creditNoteId: row.id, number, invoiceId: inv.id, invoiceNumber: inv.number, totalMinor: inv.totalMinor, reason }),
        },
      });
      return row;
    });
    return { ok: true, value: cn };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await db.taxInvoice.findUnique({ where: { orgId_sourceKey: { orgId: a.orgId, sourceKey } }, select: { id: true, number: true } });
      if (again) return { ok: true, value: again, existed: true };
    }
    if (e instanceof Error && /16-character/.test(e.message)) return { ok: false, error: "Credit note number would exceed 16 characters — shorten the prefix." };
    throw e;
  }
}

/**
 * Called after a PAID fee is reversed (flag on). Credits the latest invoice of that fee that has no credit note yet.
 * Never throws: a reversal must not fail because of invoicing; failures are audited for follow-up.
 */
export async function creditNoteForReversedFee(a: { orgId: string; feeRecordId: string; userId: string; reason: string }): Promise<void> {
  try {
    const invoices = await db.taxInvoice.findMany({
      where: { orgId: a.orgId, feeRecordId: a.feeRecordId, kind: "INVOICE" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    for (const inv of invoices) {
      const credited = await db.taxInvoice.findFirst({ where: { orgId: a.orgId, originalInvoiceId: inv.id, kind: "CREDIT_NOTE" }, select: { id: true } });
      if (credited) continue;
      await issueCreditNote({ orgId: a.orgId, invoiceId: inv.id, userId: a.userId, reason: `Fee payment reversed: ${a.reason}` });
      return;
    }
  } catch (e) {
    console.error("creditNoteForReversedFee failed:", e instanceof Error ? e.message : e);
    await db.auditLog
      .create({ data: { userId: a.userId, orgId: a.orgId, action: "GST_CREDIT_NOTE_FAILED", details: JSON.stringify({ feeRecordId: a.feeRecordId }) } })
      .catch(() => {});
  }
}
