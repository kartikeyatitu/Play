import { db } from "@/lib/db";
import crypto from "crypto";

export interface CreateReceiptParams {
  feeRecordId?: string;
  studentId: string;
  orgId: string;
  amount: number;
  month: string; // "YYYY-MM"
  paymentMode?: string; // "UPI" | "CASH" | "RAZORPAY" | "BANK_TRANSFER"
  transactionRef?: string | null;
}

/**
 * Creates or retrieves an existing verified digital receipt for a fee payment.
 * Ensures an idempotent sequential receipt number per academy and a secure verification token.
 */
export async function getOrCreateReceipt(params: CreateReceiptParams) {
  const { feeRecordId, studentId, orgId, amount, month, paymentMode = "UPI", transactionRef } = params;

  // 1. If a receipt already exists for this fee record, return it
  if (feeRecordId) {
    const existing = await db.receipt.findUnique({
      where: { feeRecordId },
    });
    if (existing) {
      return {
        ...existing,
        url: `/r/${existing.token}`,
      };
    }
  }

  // 2. Load context (student, parent, org, batch)
  const [org, student] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true },
    }),
    db.student.findUnique({
      where: { id: studentId },
      include: {
        parent: { select: { name: true, phone: true } },
        enrollments: { include: { batch: { select: { name: true, sport: true } } }, take: 1 },
      },
    }),
  ]);

  const year = new Date().getFullYear();
  const safeSlug = (org?.slug || "TRIQ").toUpperCase().slice(0, 10).replace(/[^A-Z0-9]/g, "");

  // Count existing receipts for this org to generate sequential number
  const count = await db.receipt.count({ where: { orgId } });
  const seq = String(count + 1).padStart(4, "0");
  const receiptNumber = `${safeSlug}-${year}-${seq}`;

  // Cryptographically secure 32-character random token for public URL
  const token = crypto.randomBytes(16).toString("hex");

  const batch = student?.enrollments?.[0]?.batch;
  const studentName = student?.name || "Student";
  const parentName = student?.parent?.name || null;
  const parentPhone = student?.parent?.phone || null;
  const batchName = batch?.name || null;
  const sport = batch?.sport || null;

  const receipt = await db.receipt.create({
    data: {
      receiptNumber,
      token,
      orgId,
      studentId,
      feeRecordId: feeRecordId || null,
      studentName,
      parentName,
      parentPhone,
      batchName,
      sport,
      month,
      amount,
      paymentMode,
      transactionRef: transactionRef || null,
      issuedAt: new Date(),
    },
  });

  return {
    ...receipt,
    url: `/r/${receipt.token}`,
  };
}

/**
 * Fetch a receipt by its public token along with academy details for public display
 */
export async function getReceiptByToken(token: string) {
  const receipt = await db.receipt.findUnique({
    where: { token },
  });

  if (!receipt) return null;

  const org = await db.organization.findUnique({
    where: { id: receipt.orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      sport: true,
      city: true,
      state: true,
      phone: true,
      email: true,
      logo: true,
      address: true,
      brandColor: true,
    },
  });

  return {
    receipt,
    org,
  };
}
