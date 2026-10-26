"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkPermission, hasPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { GST_INVOICES_DISABLED_ERROR, parseTaxProfile, type GstDocRow, type UninvoicedFeeRow } from "@/lib/gst";
import { issueCreditNote, issueInvoiceForFee } from "@/lib/gst-invoice-service";

/**
 * V1 Business — GST tax invoices (flag `gstInvoices`). Tables come from prisma/sql/2026-10-26_gst_invoices.sql and
 * are never touched while the flag is off. Receipts (src/lib/receipt-service.ts) are unchanged either way.
 */

type Fail = { success: false; error: string };

export async function getTaxProfile(): Promise<
  | { success: true; canEdit: boolean; profile: null | { legalName: string; gstin: string; stateCode: string; address: string; sacCode: string; rateBps: number; priceMode: string; invoicePrefix: string; creditNotePrefix: string } }
  | Fail
> {
  if (!FEATURES.gstInvoices) return { success: false, error: GST_INVOICES_DISABLED_ERROR };
  const auth = await checkPermission(null);
  if (!auth.ok) return { success: false, error: auth.error };
  const canEdit = hasPermission(auth.membership, "settings.manage");
  if (!canEdit && !hasPermission(auth.membership, "fees.collect")) return { success: false, error: "You don't have permission to do this" };
  const p = await db.orgTaxProfile.findUnique({ where: { orgId: auth.session.orgId } });
  return {
    success: true,
    canEdit,
    profile: p && {
      legalName: p.legalName,
      gstin: p.gstin,
      stateCode: p.stateCode,
      address: p.address,
      sacCode: p.sacCode,
      rateBps: p.rateBps,
      priceMode: p.priceMode,
      invoicePrefix: p.invoicePrefix,
      creditNotePrefix: p.creditNotePrefix,
    },
  };
}

export async function saveTaxProfile(input: Record<string, unknown>): Promise<{ success: true } | Fail> {
  if (!FEATURES.gstInvoices) return { success: false, error: GST_INVOICES_DISABLED_ERROR };
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const parsed = parseTaxProfile(input ?? {});
  if (!parsed.ok) return { success: false, error: parsed.error };
  const orgId = auth.session.orgId;
  const data = { ...parsed.profile, updatedById: auth.session.id };
  await db.orgTaxProfile.upsert({ where: { orgId }, create: { orgId, ...data }, update: data });
  await db.auditLog.create({
    data: {
      userId: auth.session.id,
      orgId,
      action: "GST_PROFILE_SAVED",
      details: JSON.stringify({ gstin: parsed.profile.gstin, sacCode: parsed.profile.sacCode, rateBps: parsed.profile.rateBps, priceMode: parsed.profile.priceMode }),
    },
  });
  revalidatePath("/org");
  return { success: true };
}

export async function listGstDocuments(): Promise<
  { success: true; profileReady: boolean; supplierStateCode: string | null; canCredit: boolean; documents: GstDocRow[]; uninvoiced: UninvoicedFeeRow[] } | Fail
> {
  if (!FEATURES.gstInvoices) return { success: false, error: GST_INVOICES_DISABLED_ERROR };
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;

  const since = new Date(Date.now() - 100 * 24 * 3600_000);
  const [profile, docs, paidFees] = await Promise.all([
    db.orgTaxProfile.findUnique({ where: { orgId }, select: { stateCode: true } }),
    db.taxInvoice.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, kind: true, number: true, issueDay: true, studentName: true, recipientName: true, totalMinor: true, originalInvoiceId: true, feeRecordId: true },
    }),
    db.feeRecord.findMany({
      where: {
        status: "PAID",
        amount: { gt: 0 },
        AND: [{ OR: [{ orgId }, { orgId: null, student: { orgId } }] }, { OR: [{ paidAt: { gte: since } }, { paidAt: null, createdAt: { gte: since } }] }],
      },
      orderBy: { paidAt: "desc" },
      take: 300,
      select: { id: true, month: true, amount: true, paidAt: true, student: { select: { name: true } } },
    }),
  ]);

  const creditedIds = new Set(docs.filter((d) => d.kind === "CREDIT_NOTE" && d.originalInvoiceId).map((d) => d.originalInvoiceId as string));
  // Fees that already have a live invoice. Documents beyond the 200 most recent are looked up explicitly.
  const feeIds = paidFees.map((f) => f.id);
  const invoicesForFees = feeIds.length
    ? await db.taxInvoice.findMany({ where: { orgId, feeRecordId: { in: feeIds } }, select: { id: true, kind: true, feeRecordId: true, originalInvoiceId: true } })
    : [];
  const creditedForFees = new Set(invoicesForFees.filter((d) => d.kind === "CREDIT_NOTE").map((d) => d.originalInvoiceId));
  const liveFee = new Set(invoicesForFees.filter((d) => d.kind === "INVOICE" && !creditedForFees.has(d.id)).map((d) => d.feeRecordId));

  return {
    success: true,
    profileReady: Boolean(profile),
    supplierStateCode: profile?.stateCode ?? null,
    canCredit: hasPermission(auth.membership, "fees.manage"),
    documents: docs.map((d) => ({
      id: d.id,
      kind: d.kind,
      number: d.number,
      issueDay: d.issueDay,
      studentName: d.studentName,
      recipientName: d.recipientName,
      totalMinor: d.totalMinor,
      originalInvoiceId: d.originalInvoiceId,
      credited: d.kind === "INVOICE" && creditedIds.has(d.id),
    })),
    uninvoiced: paidFees
      .filter((f) => !liveFee.has(f.id))
      .map((f) => ({ feeRecordId: f.id, studentName: f.student.name, month: f.month, amount: f.amount, paidAt: f.paidAt?.toISOString() ?? null })),
  };
}

export async function issueGstInvoice(feeRecordId: string, placeOfSupply?: string | null): Promise<{ success: true; id: string; number: string; existed: boolean } | Fail> {
  if (!FEATURES.gstInvoices) return { success: false, error: GST_INVOICES_DISABLED_ERROR };
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false, error: auth.error };
  if (typeof feeRecordId !== "string" || !feeRecordId) return { success: false, error: "Fee record not found in your academy." };
  const r = await issueInvoiceForFee({ orgId: auth.session.orgId, feeRecordId, userId: auth.session.id, placeOfSupply: placeOfSupply || null });
  if (!r.ok) return { success: false, error: r.error };
  revalidatePath("/org");
  return { success: true, id: r.value.id, number: r.value.number, existed: Boolean(r.existed) };
}

export async function issueGstCreditNote(invoiceId: string, reason: string): Promise<{ success: true; id: string; number: string; existed: boolean } | Fail> {
  if (!FEATURES.gstInvoices) return { success: false, error: GST_INVOICES_DISABLED_ERROR };
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  if (typeof invoiceId !== "string" || !invoiceId) return { success: false, error: "Invoice not found in your academy." };
  const r = await issueCreditNote({ orgId: auth.session.orgId, invoiceId, userId: auth.session.id, reason });
  if (!r.ok) return { success: false, error: r.error };
  revalidatePath("/org");
  return { success: true, id: r.value.id, number: r.value.number, existed: Boolean(r.existed) };
}

/** Full document for the printable page (fees.collect). */
export async function getGstDocument(id: string) {
  if (!FEATURES.gstInvoices) return { success: false as const, error: GST_INVOICES_DISABLED_ERROR };
  const auth = await checkPermission("fees.collect");
  if (!auth.ok) return { success: false as const, error: auth.error };
  const doc = await db.taxInvoice.findFirst({ where: { id: String(id || ""), orgId: auth.session.orgId } });
  if (!doc) return { success: false as const, error: "Document not found." };
  const original = doc.originalInvoiceId
    ? await db.taxInvoice.findFirst({ where: { id: doc.originalInvoiceId, orgId: auth.session.orgId }, select: { number: true, issueDay: true } })
    : null;
  return { success: true as const, doc, original };
}
