import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { orgToday } from "@/lib/i18n";
import { getOrgRazorpay } from "@/lib/razorpay-org";
import {
  cancelRazorpayToken,
  createRazorpayChargeOrder,
  createRazorpayRecurringPayment,
  fetchRazorpayPayment,
  fetchRazorpayToken,
  type RazorpayCreds,
} from "@/lib/gateways/razorpay";
import {
  CHARGE_SKIP_LABELS,
  chargeIdempotencyKey,
  chargeReceipt,
  decideCharge,
  isMandateStatus,
  mandateStatusFromProvider,
  nextMandateStatus,
  type MandateStatus,
} from "@/lib/autopay";

/**
 * Server-only UPI AutoPay service (flag `upiAutopay`; callers check the flag and permissions).
 *
 * Money safety: this module never marks a fee PAID. Each monthly debit creates a normal Payment row (kind AUTOPAY)
 * keyed by its Razorpay order id; the existing per-academy webhook's payment.captured → finalizePayment path is the
 * only thing that settles the fee (paymentMethod ONLINE_VERIFIED, amount re-checked).
 */

/** Razorpay requires an email on recurring debits; this is Razorpay's documented placeholder when none is known. */
const NO_EMAIL = "void@razorpay.com";

type MandateRow = Prisma.FeeMandateGetPayload<object>;

async function audit(userId: string, orgId: string, action: string, details: Record<string, unknown>) {
  await db.auditLog.create({ data: { userId, orgId, action, details: JSON.stringify(details) } }).catch(() => {});
}

/**
 * Move a mandate to `incoming` if the state machine allows it. Compare-and-set on the current status, so concurrent
 * webhook + checkout + sync calls can't clobber each other. Returns the status after the call.
 */
export async function applyMandateStatus(
  mandate: Pick<MandateRow, "id" | "orgId" | "parentId" | "status">,
  incoming: MandateStatus | null,
  meta: { providerStatus?: string | null; tokenId?: string | null; authPaymentId?: string | null; reason?: string | null; actorId?: string | null; source: string },
): Promise<MandateStatus> {
  const current = isMandateStatus(mandate.status) ? mandate.status : "CREATED";
  const next = nextMandateStatus(current, incoming);
  const extra: Prisma.FeeMandateUpdateManyMutationInput = {};
  if (meta.providerStatus) extra.providerStatus = meta.providerStatus.slice(0, 40);
  if (meta.tokenId) extra.providerTokenId = meta.tokenId;
  if (meta.authPaymentId) extra.authPaymentId = meta.authPaymentId;
  if (!next) {
    if (Object.keys(extra).length) await db.feeMandate.updateMany({ where: { id: mandate.id, status: current }, data: extra });
    return current;
  }
  const moved = await db.feeMandate.updateMany({
    where: { id: mandate.id, status: current },
    data: {
      ...extra,
      status: next,
      ...(next === "FAILED" && meta.reason ? { failureReason: meta.reason.slice(0, 200) } : {}),
      ...(next === "CANCELLED" ? { cancelledAt: new Date(), cancelledById: meta.actorId ?? null } : {}),
    },
  });
  if (moved.count === 0) {
    const fresh = await db.feeMandate.findUnique({ where: { id: mandate.id }, select: { status: true } });
    return (fresh?.status as MandateStatus) ?? current;
  }
  await audit(meta.actorId ?? mandate.parentId, mandate.orgId, `AUTOPAY_MANDATE_${next}`, {
    mandateId: mandate.id,
    from: current,
    to: next,
    source: meta.source,
    providerStatus: meta.providerStatus ?? null,
  });
  return next;
}

/** Pull the token status from Razorpay and apply it. Used after checkout, by the admin "Refresh" and before charging. */
export async function syncMandateFromProvider(mandate: MandateRow, actorId: string | null, creds?: RazorpayCreds | null): Promise<{ status: MandateStatus; error?: string }> {
  const c = creds ?? (await getOrgRazorpay(mandate.orgId));
  if (!c) return { status: mandate.status as MandateStatus, error: "Razorpay is not connected for this academy." };
  try {
    let tokenId = mandate.providerTokenId;
    if (!tokenId && mandate.authPaymentId) {
      tokenId = (await fetchRazorpayPayment(c, mandate.authPaymentId)).tokenId;
    }
    if (!tokenId) return { status: mandate.status as MandateStatus };
    const t = await fetchRazorpayToken(c, mandate.providerCustomerId, tokenId);
    const status = await applyMandateStatus(mandate, mandateStatusFromProvider(t.status), {
      providerStatus: t.status,
      tokenId,
      actorId,
      source: "sync",
    });
    return { status };
  } catch (e) {
    return { status: mandate.status as MandateStatus, error: e instanceof Error ? e.message.slice(0, 200) : "Sync failed" };
  }
}

/** Cancel at Razorpay first (if a token exists), then locally. */
export async function cancelMandate(mandate: MandateRow, actorId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isMandateStatus(mandate.status) || ["CANCELLED", "EXPIRED", "FAILED"].includes(mandate.status)) {
    return { ok: false, error: "This mandate is already closed." };
  }
  if (mandate.providerTokenId) {
    const creds = await getOrgRazorpay(mandate.orgId);
    if (!creds) return { ok: false, error: "Razorpay is not connected; cancel the mandate from your UPI app." };
    try {
      await cancelRazorpayToken(creds, mandate.providerCustomerId, mandate.providerTokenId);
    } catch (e) {
      return { ok: false, error: `Razorpay could not cancel the mandate: ${e instanceof Error ? e.message.slice(0, 120) : "error"}` };
    }
  }
  await applyMandateStatus(mandate, "CANCELLED", { actorId, providerStatus: mandate.providerTokenId ? "cancellation_initiated" : null, source: `cancel:${reason}` });
  return { ok: true };
}

export type ChargeRunResult = { submitted: number; failed: number; skipped: { mandateId: string; reason: string }[] };

/**
 * Create this month's debits for every ACTIVE mandate of an academy. Idempotent: the charge row's unique
 * idempotency key (mandate + month) is inserted before any Razorpay call, so a second run never double-charges.
 */
export async function createChargesForOrg(orgId: string, actorId: string | null): Promise<ChargeRunResult> {
  const result: ChargeRunResult = { submitted: 0, failed: 0, skipped: [] };
  const creds = await getOrgRazorpay(orgId);
  if (!creds) return { ...result, skipped: [{ mandateId: "-", reason: "Razorpay is not connected" }] };

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { timezone: true, name: true } });
  const today = orgToday(org);
  const month = today.slice(0, 7);

  // Mandates approved but not yet confirmed may have been confirmed without us seeing the webhook.
  const pending = await db.feeMandate.findMany({ where: { orgId, status: "AUTHENTICATED" }, take: 200 });
  for (const m of pending) await syncMandateFromProvider(m, actorId, creds);

  const mandates = await db.feeMandate.findMany({ where: { orgId, status: "ACTIVE" }, take: 1000 });
  if (!mandates.length) return result;

  const studentIds = mandates.map((m) => m.studentId);
  const [fees, charges] = await Promise.all([
    db.feeRecord.findMany({
      where: { studentId: { in: studentIds }, month, OR: [{ orgId }, { orgId: null, student: { orgId } }] },
      select: { id: true, studentId: true, status: true, amount: true, month: true },
    }),
    db.feeMandateCharge.findMany({ where: { orgId, mandateId: { in: mandates.map((m) => m.id) } }, select: { mandateId: true, month: true, status: true, paymentRowId: true } }),
  ]);
  const paymentIds = charges.map((c) => c.paymentRowId).filter((x): x is string => Boolean(x));
  const payments = paymentIds.length ? await db.payment.findMany({ where: { id: { in: paymentIds } }, select: { id: true, status: true } }) : [];
  const paymentStatus = new Map(payments.map((p) => [p.id, p.status]));
  const feeByStudent = new Map(fees.map((f) => [f.studentId, f]));

  for (const m of mandates) {
    const fee = feeByStudent.get(m.studentId);
    if (!fee) {
      result.skipped.push({ mandateId: m.id, reason: "No fee record for this month yet" });
      continue;
    }
    const mine = charges.filter((c) => c.mandateId === m.id);
    const decision = decideCharge({
      mandate: { status: m.status as MandateStatus, maxAmountMinor: m.maxAmountMinor, providerTokenId: m.providerTokenId, expireAt: m.expireAt },
      fee,
      today,
      alreadyCharged: mine.some((c) => c.month === month),
      inFlight: mine.some((c) => c.status === "SUBMITTED" && c.paymentRowId && paymentStatus.get(c.paymentRowId) === "CREATED"),
    });
    if (!decision.ok) {
      result.skipped.push({ mandateId: m.id, reason: CHARGE_SKIP_LABELS[decision.reason] });
      continue;
    }
    const r = await submitNewCharge({ mandate: m, feeRecordId: fee.id, month, amountMinor: decision.amountMinor, creds, actorId, academyName: org?.name ?? "Academy" });
    if (r === "SUBMITTED") result.submitted++;
    else if (r === "DUPLICATE") result.skipped.push({ mandateId: m.id, reason: CHARGE_SKIP_LABELS.ALREADY_CHARGED });
    else result.failed++;
  }
  return result;
}

async function submitNewCharge(a: {
  mandate: MandateRow;
  feeRecordId: string;
  month: string;
  amountMinor: number;
  creds: RazorpayCreds;
  actorId: string | null;
  academyName: string;
}): Promise<"SUBMITTED" | "FAILED" | "DUPLICATE"> {
  let charge;
  try {
    charge = await db.feeMandateCharge.create({
      data: {
        orgId: a.mandate.orgId,
        mandateId: a.mandate.id,
        feeRecordId: a.feeRecordId,
        month: a.month,
        idempotencyKey: chargeIdempotencyKey(a.mandate.id, a.month),
        amountMinor: a.amountMinor,
        createdById: a.actorId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "DUPLICATE";
    throw e;
  }
  await audit(a.actorId ?? a.mandate.parentId, a.mandate.orgId, "AUTOPAY_CHARGE_CREATED", {
    chargeId: charge.id,
    mandateId: a.mandate.id,
    feeRecordId: a.feeRecordId,
    month: a.month,
    amountMinor: a.amountMinor,
    by: a.actorId ? "admin" : "scheduler",
  });
  return submitCharge(charge.id, a.creds, a.academyName);
}

/** Create the order + Payment row (once) and ask Razorpay to debit. Safe to call again for SUBMIT_FAILED charges. */
export async function submitCharge(chargeId: string, creds: RazorpayCreds, academyName: string): Promise<"SUBMITTED" | "FAILED"> {
  const charge = await db.feeMandateCharge.findUnique({ where: { id: chargeId } });
  if (!charge || charge.status === "SUBMITTED") return "SUBMITTED";
  const mandate = await db.feeMandate.findUnique({ where: { id: charge.mandateId } });
  const fee = await db.feeRecord.findUnique({ where: { id: charge.feeRecordId }, select: { status: true, amount: true, studentId: true } });
  const parent = mandate ? await db.user.findUnique({ where: { id: mandate.parentId }, select: { email: true, phone: true, name: true } }) : null;

  const failWith = async (reason: string) => {
    await db.feeMandateCharge.update({ where: { id: charge.id }, data: { status: "SUBMIT_FAILED", failureReason: reason.slice(0, 200), attempts: { increment: 1 } } });
    if (mandate) await audit(mandate.parentId, charge.orgId, "AUTOPAY_CHARGE_SUBMIT_FAILED", { chargeId: charge.id, reason: reason.slice(0, 200) });
    return "FAILED" as const;
  };

  if (!mandate || mandate.status !== "ACTIVE" || !mandate.providerTokenId) return failWith("Mandate is not active");
  // Re-check right before moving money: paid by cash meanwhile, or amount changed → don't debit.
  if (!fee || fee.status !== "PENDING") return failWith("Fee is no longer pending");
  if (Math.round(fee.amount * 100) !== charge.amountMinor) return failWith("Fee amount changed since the charge was created");
  if (!parent?.phone) return failWith("Parent has no phone number on file");

  try {
    let orderId = charge.providerOrderId;
    let paymentRowId = charge.paymentRowId;
    if (!orderId) {
      const order = await createRazorpayChargeOrder(creds, {
        amountMinor: charge.amountMinor,
        receipt: chargeReceipt(mandate.id, charge.month),
        notes: { feeRecordId: charge.feeRecordId, mandateId: mandate.id, month: charge.month, orgId: charge.orgId, kind: "autopay" },
      });
      orderId = order.id;
      // The Payment row is what the existing webhook reconciles (amount re-checked, fee → PAID ONLINE_VERIFIED).
      const payment = await db.payment.create({
        data: {
          orgId: charge.orgId,
          studentId: fee.studentId,
          feeRecordId: charge.feeRecordId,
          parentId: mandate.parentId,
          provider: "RAZORPAY",
          providerOrderId: orderId,
          amount: charge.amountMinor,
          currency: "INR",
          kind: "AUTOPAY",
        },
      });
      paymentRowId = payment.id;
      await db.feeMandateCharge.update({ where: { id: charge.id }, data: { providerOrderId: orderId, paymentRowId } });
    }
    const r = await createRazorpayRecurringPayment(creds, {
      amountMinor: charge.amountMinor,
      orderId,
      customerId: mandate.providerCustomerId,
      tokenId: mandate.providerTokenId,
      email: parent.email || NO_EMAIL,
      contact: parent.phone,
      description: `${academyName} fee ${charge.month}`,
      notes: { feeRecordId: charge.feeRecordId, mandateId: mandate.id, month: charge.month },
    });
    await db.feeMandateCharge.update({
      where: { id: charge.id },
      data: { status: "SUBMITTED", providerPaymentId: r.paymentId, failureReason: null, attempts: { increment: 1 } },
    });
    await audit(mandate.parentId, charge.orgId, "AUTOPAY_CHARGE_SUBMITTED", { chargeId: charge.id, orderId, paymentId: r.paymentId, amountMinor: charge.amountMinor });
    return "SUBMITTED";
  } catch (e) {
    return failWith(e instanceof Error ? e.message : "Razorpay error");
  }
}

/** Best-effort: a mandate we already closed got authorised anyway (old tab) → revoke it so it can't be debited. */
export async function revokeOrphanToken(orgId: string, customerId: string, tokenId: string): Promise<void> {
  const creds = await getOrgRazorpay(orgId);
  if (!creds) return;
  await cancelRazorpayToken(creds, customerId, tokenId).catch(() => {});
}
