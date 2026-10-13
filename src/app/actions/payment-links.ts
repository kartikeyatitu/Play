"use server";

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { resolveStudentFee } from "@/lib/fees";
import { finalizePayment } from "@/lib/payment-service";
import { getOrgRazorpay } from "@/lib/razorpay-org";
import { createRazorpayPaymentLink, fetchRazorpayPaymentLink } from "@/lib/gateways/razorpay";

type LinkResult = { success: true; url: string; amount: number; reused: boolean } | { success: false; error: string };

/**
 * ADMIN: create (or reuse) a Razorpay Payment Link for a student's monthly fee, on the academy's
 * OWN Razorpay account. The amount always comes from the server-side FeeRecord. The fee flips to
 * PAID automatically via webhook (or "Check status") — the parent doesn't need to log in.
 */
export async function createFeePaymentLink(studentId: string, month: string): Promise<LinkResult> {
  const session = await requireAuth(["ADMIN"]);
  try {
    if (!session.orgId) return { success: false, error: "No academy found for your account." };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return { success: false, error: "Invalid month." };
    if (!rateLimit(`plink:${session.orgId}`, 30, 60_000).allowed) return { success: false, error: "Too many links at once. Please wait a minute." };

    const creds = await getOrgRazorpay(session.orgId);
    if (!creds) return { success: false, error: "Connect your Razorpay account in Settings first." };

    const student = await db.student.findFirst({
      where: { id: studentId, orgId: session.orgId },
      include: { enrollments: { include: { batch: true } }, org: true, parent: { select: { id: true, name: true, phone: true, email: true } } },
    });
    if (!student) return { success: false, error: "Student not found in your academy." };

    let fee = await db.feeRecord.findFirst({ where: { studentId, month } });
    if (!fee) {
      const amount = resolveStudentFee(student, student.org?.defaultMonthlyFee);
      if (!(amount > 0)) return { success: false, error: "Set a fee for this student's batch first." };
      fee = await db.feeRecord.create({ data: { orgId: session.orgId, studentId, amount, month, status: "PENDING" } });
    }
    if (fee.status === "PAID") return { success: false, error: "This fee is already paid." };
    if (!(fee.amount > 0)) return { success: false, error: "Set a fee for this student's batch first." };
    const amountMinor = Math.round(fee.amount * 100);

    // Reuse an open link for the same amount instead of creating duplicates
    const open = await db.payment.findFirst({
      where: { feeRecordId: fee.id, orgId: session.orgId, kind: "LINK", status: "CREATED", amount: amountMinor, linkUrl: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (open?.linkUrl) return { success: true, url: open.linkUrl, amount: fee.amount, reused: true };

    const payment = await db.payment.create({
      data: {
        orgId: session.orgId,
        studentId,
        feeRecordId: fee.id,
        parentId: student.parentId,
        provider: "RAZORPAY",
        kind: "LINK",
        providerOrderId: `pending_${randomUUID()}`,
        amount: amountMinor,
        currency: "INR",
      },
    });
    try {
      const phone = (student.parent?.phone || "").replace(/\D/g, "").slice(-10);
      const link = await createRazorpayPaymentLink(creds, {
        amountMinor,
        description: `${student.name} - ${month} fee - ${student.org?.name || "Academy"}`,
        referenceId: payment.id,
        customer: {
          name: student.parent?.name || undefined,
          contact: phone.length === 10 ? `+91${phone}` : undefined,
          email: student.parent?.email || undefined,
        },
        notes: { feeRecordId: fee.id, studentId, month, orgId: session.orgId },
        expireBy: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      });
      await db.payment.update({ where: { id: payment.id }, data: { providerOrderId: link.id, linkUrl: link.shortUrl } });
      await db.auditLog
        .create({ data: { userId: session.id, orgId: session.orgId, action: "PAYMENT_LINK_CREATED", details: JSON.stringify({ paymentId: payment.id, feeRecordId: fee.id, amountMinor }) } })
        .catch(() => {});
      return { success: true, url: link.shortUrl, amount: fee.amount, reused: false };
    } catch (e) {
      await db.payment.delete({ where: { id: payment.id } }).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error("createFeePaymentLink failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't create the payment link. Check your Razorpay connection in Settings." };
  }
}

/** ADMIN: ask Razorpay whether the latest link for this fee was paid (fallback when no webhook is set up). */
export async function syncFeePaymentLink(studentId: string, month: string): Promise<{ success: boolean; paid?: boolean; status?: string; error?: string }> {
  const session = await requireAuth(["ADMIN"]);
  try {
    if (!session.orgId) return { success: false, error: "No academy found for your account." };
    const creds = await getOrgRazorpay(session.orgId);
    if (!creds) return { success: false, error: "Razorpay isn't connected." };
    const fee = await db.feeRecord.findFirst({ where: { studentId, month, student: { orgId: session.orgId } } });
    if (!fee) return { success: true, paid: false, status: "no_link" };
    if (fee.status === "PAID") return { success: true, paid: true, status: "paid" };

    const payment = await db.payment.findFirst({
      where: { feeRecordId: fee.id, orgId: session.orgId, kind: "LINK", providerOrderId: { startsWith: "plink_" } },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) return { success: true, paid: false, status: "no_link" };
    if (payment.status === "PAID") return { success: true, paid: true, status: "paid" };

    const link = await fetchRazorpayPaymentLink(creds, payment.providerOrderId);
    if (link.status !== "paid") return { success: true, paid: false, status: link.status };
    const r = await finalizePayment({
      provider: "RAZORPAY",
      providerOrderId: payment.providerOrderId,
      providerPaymentId: link.paymentId,
      amountMinor: link.amountPaid,
      currency: "INR",
    });
    return r.ok ? { success: true, paid: true, status: "paid" } : { success: false, error: r.error === "AMOUNT_MISMATCH" ? "Amount paid differs from the fee. Flagged for review." : "Paid, but couldn't be recorded yet." };
  } catch (e) {
    console.error("syncFeePaymentLink failed:", e instanceof Error ? e.message : e);
    return { success: false, error: "Couldn't check with Razorpay right now." };
  }
}
