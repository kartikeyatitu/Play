"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/membership";
import { FEATURES } from "@/lib/features";
import { rateLimitDb } from "@/lib/rate-limit";
import { getOrgRazorpay } from "@/lib/razorpay-org";
import { createRazorpayCustomer, createRazorpayMandateOrder, fetchRazorpayPayment, verifyRazorpayCheckoutSignature } from "@/lib/gateways/razorpay";
import { formatMoney, orgCurrentMonth } from "@/lib/i18n";
import {
  AUTH_AMOUNT_MINOR,
  CONSENT_VERSION,
  LIVE_MANDATE_STATUSES,
  MANDATE_STATUS_LABELS,
  UPI_AUTOPAY_DISABLED_ERROR,
  consentText,
  mandateExpiry,
  suggestedMaxAmountMinor,
  validateMaxAmount,
  type AutopayAdminRow,
  type AutopayParentView,
  type MandateStatus,
} from "@/lib/autopay";
import { applyMandateStatus, cancelMandate, createChargesForOrg, submitCharge, syncMandateFromProvider, type ChargeRunResult } from "@/lib/autopay-service";

/**
 * V1 Business — UPI AutoPay fee mandates (flag `upiAutopay`). Tables from prisma/sql/2026-10-26_upi_autopay.sql
 * are never touched while the flag is off. No action here marks a fee PAID: that only happens through the verified
 * Razorpay payment.captured webhook (finalizePayment, paymentMethod ONLINE_VERIFIED).
 */

type Fail = { success: false; error: string };

const rupees = (minor: number) => formatMoney(minor / 100, { currency: "INR", locale: "en-IN" });

async function parentStudent(parentId: string, studentId: string) {
  if (typeof studentId !== "string" || !studentId) return null;
  return db.student.findFirst({
    where: { id: studentId, parentId },
    select: {
      id: true,
      name: true,
      orgId: true,
      parent: { select: { name: true, phone: true, email: true } },
      org: { select: { name: true, timezone: true } },
    },
  });
}

/** Parent: AutoPay state for one child (shown on the fee screen). */
export async function getAutopayForStudent(studentId: string): Promise<({ success: true } & AutopayParentView) | Fail> {
  if (!FEATURES.upiAutopay) return { success: false, error: UPI_AUTOPAY_DISABLED_ERROR };
  const session = await requireAuth(["PARENT"]);
  const student = await parentStudent(session.id, studentId);
  if (!student?.orgId) return { success: false, error: "Student not found." };
  const creds = await getOrgRazorpay(student.orgId);
  const month = orgCurrentMonth(student.org);
  const [mandate, fee] = await Promise.all([
    db.feeMandate.findFirst({ where: { studentId: student.id, orgId: student.orgId }, orderBy: { createdAt: "desc" } }),
    db.feeRecord.findFirst({ where: { studentId: student.id, month }, select: { amount: true } }),
  ]);
  const feeMinor = Math.round((fee?.amount ?? 0) * 100);
  const suggested = suggestedMaxAmountMinor(feeMinor);
  return {
    success: true,
    available: Boolean(creds),
    academyName: student.org?.name ?? "Academy",
    studentName: student.name,
    currentFeeMinor: feeMinor,
    suggestedMaxRupees: suggested / 100,
    consentPreview: consentText({
      academyName: student.org?.name ?? "the academy",
      studentName: student.name,
      maxAmountLabel: rupees(suggested),
      authAmountLabel: rupees(AUTH_AMOUNT_MINOR),
    }),
    mandate: mandate && {
      id: mandate.id,
      status: mandate.status,
      statusLabel: MANDATE_STATUS_LABELS[mandate.status as MandateStatus] ?? mandate.status,
      maxAmountMinor: mandate.maxAmountMinor,
      createdAt: mandate.createdAt.toISOString(),
    },
  };
}

/** Parent: start a mandate. Returns Razorpay Checkout options (recurring: "1"). */
export async function startAutopayMandate(input: { studentId: string; maxAmountRupees: number; consent: boolean }): Promise<
  | { success: true; mandateId: string; keyId: string; orderId: string; customerId: string; amountMinor: number; name: string; description: string; prefill: { name?: string; contact?: string; email?: string } }
  | Fail
> {
  if (!FEATURES.upiAutopay) return { success: false, error: UPI_AUTOPAY_DISABLED_ERROR };
  const session = await requireAuth(["PARENT"]);
  if (!(await rateLimitDb(`autopay:${session.id}`, 5, 10 * 60_000)).allowed) return { success: false, error: "Too many attempts. Please wait a few minutes." };
  if (input?.consent !== true) return { success: false, error: "Please read and accept the AutoPay terms." };
  const student = await parentStudent(session.id, input?.studentId);
  if (!student?.orgId) return { success: false, error: "Student not found." };
  const orgId = student.orgId;
  const creds = await getOrgRazorpay(orgId);
  if (!creds) return { success: false, error: "This academy hasn't set up online payments yet." };

  const fee = await db.feeRecord.findFirst({ where: { studentId: student.id, month: orgCurrentMonth(student.org) }, select: { amount: true } });
  const max = validateMaxAmount(input?.maxAmountRupees, Math.round((fee?.amount ?? 0) * 100));
  if (!max.ok) return { success: false, error: max.error };

  const live = await db.feeMandate.findMany({ where: { studentId: student.id, status: { in: [...LIVE_MANDATE_STATUSES] } } });
  if (live.some((m) => m.status !== "CREATED")) return { success: false, error: "AutoPay is already set up for this child." };
  // An abandoned earlier attempt (never approved) is superseded by this one.
  for (const m of live) await applyMandateStatus(m, "EXPIRED", { actorId: session.id, source: "superseded" });

  const academyName = student.org?.name ?? "Academy";
  const text = consentText({ academyName, studentName: student.name, maxAmountLabel: rupees(max.maxAmountMinor), authAmountLabel: rupees(AUTH_AMOUNT_MINOR) });
  const now = new Date();
  const expireAt = mandateExpiry(now);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || null;

  try {
    const customer = await createRazorpayCustomer(creds, {
      name: student.parent?.name || "Parent",
      contact: student.parent?.phone || undefined,
      email: student.parent?.email || undefined,
      notes: { parentId: session.id },
    });
    const order = await createRazorpayMandateOrder(creds, {
      amountMinor: AUTH_AMOUNT_MINOR,
      customerId: customer.id,
      maxAmountMinor: max.maxAmountMinor,
      expireAt,
      receipt: `mandate_${student.id.slice(-12)}_${now.getTime().toString(36)}`,
      notes: { studentId: student.id, orgId, kind: "autopay_mandate" },
    });
    const mandate = await db.feeMandate.create({
      data: {
        orgId,
        studentId: student.id,
        parentId: session.id,
        providerCustomerId: customer.id,
        authOrderId: order.id,
        maxAmountMinor: max.maxAmountMinor,
        expireAt: new Date(expireAt * 1000),
        consentText: text,
        consentVersion: CONSENT_VERSION,
        consentAt: now,
        consentIp: ip,
      },
    });
    await db.auditLog.create({
      data: {
        userId: session.id,
        orgId,
        action: "AUTOPAY_MANDATE_CREATED",
        details: JSON.stringify({ mandateId: mandate.id, studentId: student.id, maxAmountMinor: max.maxAmountMinor, consentVersion: CONSENT_VERSION }),
      },
    });
    return {
      success: true,
      mandateId: mandate.id,
      keyId: creds.keyId,
      orderId: order.id,
      customerId: customer.id,
      amountMinor: AUTH_AMOUNT_MINOR,
      name: academyName,
      description: `UPI AutoPay for ${student.name}'s monthly fee`,
      prefill: { name: student.parent?.name || undefined, contact: student.parent?.phone || undefined, email: student.parent?.email || undefined },
    };
  } catch (e) {
    console.error("startAutopayMandate failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't start AutoPay setup. Please try again later." };
  }
}

/** Parent: Checkout handler after the UPI app approval. Verifies the signature, stores the token, syncs status. */
export async function confirmAutopayAuthorisation(a: { mandateId: string; orderId: string; paymentId: string; signature: string }): Promise<{ success: true; status: string } | Fail> {
  if (!FEATURES.upiAutopay) return { success: false, error: UPI_AUTOPAY_DISABLED_ERROR };
  const session = await requireAuth(["PARENT"]);
  if (!a?.mandateId || !a?.orderId || !a?.paymentId || !a?.signature) return { success: false, error: "Missing payment details." };
  const mandate = await db.feeMandate.findFirst({ where: { id: a.mandateId, parentId: session.id } });
  if (!mandate || mandate.authOrderId !== a.orderId) return { success: false, error: "AutoPay request not found." };
  const creds = await getOrgRazorpay(mandate.orgId);
  if (!creds) return { success: false, error: "Academy payment credentials not found." };
  if (!verifyRazorpayCheckoutSignature(creds.keySecret, a.orderId, a.paymentId, a.signature)) {
    return { success: false, error: "We couldn't verify the approval. If it went through, it will update shortly." };
  }
  try {
    const p = await fetchRazorpayPayment(creds, a.paymentId);
    const status = await applyMandateStatus(mandate, "AUTHENTICATED", { tokenId: p.tokenId, authPaymentId: a.paymentId, actorId: session.id, source: "checkout" });
    const fresh = await db.feeMandate.findUnique({ where: { id: mandate.id } });
    const synced = fresh ? await syncMandateFromProvider(fresh, session.id, creds) : { status };
    revalidatePath("/parent");
    return { success: true, status: synced.status };
  } catch (e) {
    console.error("confirmAutopayAuthorisation failed:", e instanceof Error ? e.message : e);
    // Signature was valid: record what we know; the webhook / sync completes it.
    await applyMandateStatus(mandate, "AUTHENTICATED", { authPaymentId: a.paymentId, actorId: session.id, source: "checkout" });
    return { success: true, status: "AUTHENTICATED" };
  }
}

/** Parent (own child) or admin with fees.manage: cancel a mandate. */
export async function cancelAutopayMandate(mandateId: string): Promise<{ success: true } | Fail> {
  if (!FEATURES.upiAutopay) return { success: false, error: UPI_AUTOPAY_DISABLED_ERROR };
  const session = await getSession();
  if (!session) return { success: false, error: "Please sign in again." };
  let mandate = null;
  let actorId = session.id as string;
  if (session.role === "PARENT") {
    mandate = await db.feeMandate.findFirst({ where: { id: String(mandateId || ""), parentId: session.id } });
  } else {
    const auth = await checkPermission("fees.manage");
    if (!auth.ok) return { success: false, error: auth.error };
    actorId = auth.session.id;
    mandate = await db.feeMandate.findFirst({ where: { id: String(mandateId || ""), orgId: auth.session.orgId } });
  }
  if (!mandate) return { success: false, error: "Mandate not found." };
  const r = await cancelMandate(mandate, actorId, session.role === "PARENT" ? "parent" : "academy");
  if (!r.ok) return { success: false, error: r.error };
  revalidatePath("/parent");
  revalidatePath("/org");
  return { success: true };
}

/** Admin: mandates of this academy with their recent debits. */
export async function listAutopayMandates(): Promise<{ success: true; month: string; rows: AutopayAdminRow[] } | Fail> {
  if (!FEATURES.upiAutopay) return { success: false, error: UPI_AUTOPAY_DISABLED_ERROR };
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const orgId = auth.session.orgId;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true } });
  const month = orgCurrentMonth(org);
  const mandates = await db.feeMandate.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 300 });
  const [students, charges] = await Promise.all([
    db.student.findMany({ where: { id: { in: mandates.map((m) => m.studentId) }, orgId }, select: { id: true, name: true, parent: { select: { name: true } } } }),
    db.feeMandateCharge.findMany({ where: { orgId, mandateId: { in: mandates.map((m) => m.id) } }, orderBy: { createdAt: "desc" }, take: 900 }),
  ]);
  const paymentIds = charges.map((c) => c.paymentRowId).filter((x): x is string => Boolean(x));
  const payments = paymentIds.length ? await db.payment.findMany({ where: { id: { in: paymentIds }, orgId }, select: { id: true, status: true } }) : [];
  const payStatus = new Map(payments.map((p) => [p.id, p.status]));
  const byId = new Map(students.map((s) => [s.id, s]));
  return {
    success: true,
    month,
    rows: mandates.map((m) => {
      const last = charges.find((c) => c.mandateId === m.id);
      return {
        id: m.id,
        studentName: byId.get(m.studentId)?.name ?? "Student",
        parentName: byId.get(m.studentId)?.parent?.name ?? null,
        status: m.status,
        statusLabel: MANDATE_STATUS_LABELS[m.status as MandateStatus] ?? m.status,
        maxAmountMinor: m.maxAmountMinor,
        createdAt: m.createdAt.toISOString(),
        lastCharge: last
          ? {
              id: last.id,
              month: last.month,
              amountMinor: last.amountMinor,
              status: last.status,
              paymentStatus: last.paymentRowId ? payStatus.get(last.paymentRowId) ?? null : null,
              failureReason: last.failureReason,
            }
          : null,
      };
    }),
  };
}

/** Admin: refresh one mandate's status from Razorpay. */
export async function syncAutopayMandate(mandateId: string): Promise<{ success: true; status: string } | Fail> {
  if (!FEATURES.upiAutopay) return { success: false, error: UPI_AUTOPAY_DISABLED_ERROR };
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const mandate = await db.feeMandate.findFirst({ where: { id: String(mandateId || ""), orgId: auth.session.orgId } });
  if (!mandate) return { success: false, error: "Mandate not found." };
  const r = await syncMandateFromProvider(mandate, auth.session.id);
  if (r.error) return { success: false, error: r.error };
  revalidatePath("/org");
  return { success: true, status: r.status };
}

/** Admin: create this month's AutoPay debits now (same logic as the scheduled job; idempotent). */
export async function createAutopayCharges(): Promise<({ success: true } & ChargeRunResult) | Fail> {
  if (!FEATURES.upiAutopay) return { success: false, error: UPI_AUTOPAY_DISABLED_ERROR };
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  if (!(await rateLimitDb(`autopay-run:${auth.session.orgId}`, 6, 10 * 60_000)).allowed) return { success: false, error: "Please wait a few minutes before running again." };
  const r = await createChargesForOrg(auth.session.orgId, auth.session.id);
  await db.auditLog.create({
    data: { userId: auth.session.id, orgId: auth.session.orgId, action: "AUTOPAY_CHARGE_RUN", details: JSON.stringify({ submitted: r.submitted, failed: r.failed, skipped: r.skipped.length }) },
  });
  revalidatePath("/org");
  return { success: true, ...r };
}

/** Admin: re-submit a debit whose submission to Razorpay failed (same order, same idempotency key). */
export async function retryAutopayCharge(chargeId: string): Promise<{ success: true; status: string } | Fail> {
  if (!FEATURES.upiAutopay) return { success: false, error: UPI_AUTOPAY_DISABLED_ERROR };
  const auth = await checkPermission("fees.manage");
  if (!auth.ok) return { success: false, error: auth.error };
  const charge = await db.feeMandateCharge.findFirst({ where: { id: String(chargeId || ""), orgId: auth.session.orgId } });
  if (!charge) return { success: false, error: "Charge not found." };
  if (charge.status !== "SUBMIT_FAILED") return { success: false, error: "Only failed submissions can be retried." };
  const creds = await getOrgRazorpay(auth.session.orgId);
  if (!creds) return { success: false, error: "Razorpay is not connected." };
  const org = await db.organization.findUnique({ where: { id: auth.session.orgId }, select: { name: true } });
  const status = await submitCharge(charge.id, creds, org?.name ?? "Academy");
  await db.auditLog.create({ data: { userId: auth.session.id, orgId: auth.session.orgId, action: "AUTOPAY_CHARGE_RETRY", details: JSON.stringify({ chargeId: charge.id, status }) } });
  revalidatePath("/org");
  return { success: true, status };
}
