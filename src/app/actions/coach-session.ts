"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { istToday } from "@/lib/fees";

type Result = { success: true } | { success: false; error: string };

/** Coach may act on own batches; admin on any batch in their academy. */
async function ownedBatch(batchId: string) {
  const session = await requireAuth(["COACH", "ADMIN"]);
  if (!session.orgId) return { error: "No academy found for your account." } as const;
  const batch = await db.batch.findFirst({
    where:
      session.role === "COACH"
        ? { id: batchId, orgId: session.orgId, coachId: session.id }
        : { id: batchId, orgId: session.orgId },
    select: { id: true, name: true, orgId: true },
  });
  if (!batch) return { error: "Batch not found or not assigned to you." } as const;
  return { session, batch, orgId: session.orgId } as const;
}

function refresh() {
  revalidatePath("/coach");
  revalidatePath("/parent");
  revalidatePath("/org");
}

/** Cancel today's session for a batch and (optionally) notify the batch's parents. */
export async function cancelTodaySession(batchId: string, reason: string, notifyParents = true): Promise<Result> {
  const auth = await ownedBatch(batchId);
  if ("error" in auth) return { success: false, error: auth.error as string };
  const cleanReason = (reason || "").trim().slice(0, 300) || "Unavoidable circumstances";
  const today = istToday();

  await db.session.upsert({
    where: { batchId_date: { batchId, date: today } },
    update: { status: "CANCELLED", cancelReason: cleanReason },
    create: { batchId, date: today, status: "CANCELLED", cancelReason: cleanReason, orgId: auth.orgId },
  });

  if (notifyParents) {
    await db.announcement.create({
      data: {
        orgId: auth.orgId,
        batchId,
        kind: "CANCELLATION",
        authorId: auth.session.id,
        title: `Today's ${auth.batch.name} session is cancelled`,
        message: `Reason: ${cleanReason}. Sorry for the inconvenience — see you at the next session!`,
      },
    });
  }

  refresh();
  return { success: true };
}

/** Undo a cancellation (only if no attendance has been lost — attendance rows are kept anyway). */
export async function restoreTodaySession(batchId: string): Promise<Result> {
  const auth = await ownedBatch(batchId);
  if ("error" in auth) return { success: false, error: auth.error as string };
  const today = istToday();
  await db.session.updateMany({
    where: { batchId, date: today, status: "CANCELLED" },
    data: { status: "COMPLETED", cancelReason: null },
  });
  refresh();
  return { success: true };
}

/** Save the post-session recap and optionally publish it to the batch's parents. */
export async function saveSessionRecap(batchId: string, recap: string, shareWithParents: boolean): Promise<Result> {
  const auth = await ownedBatch(batchId);
  if ("error" in auth) return { success: false, error: auth.error as string };
  const text = (recap || "").trim().slice(0, 2000);
  if (!text) return { success: false, error: "Recap is empty." };
  const today = istToday();

  const existing = await db.session.findUnique({ where: { batchId_date: { batchId, date: today } } });
  if (existing?.status === "CANCELLED") return { success: false, error: "This session was cancelled." };

  await db.session.upsert({
    where: { batchId_date: { batchId, date: today } },
    update: { recap: text },
    create: { batchId, date: today, status: "COMPLETED", recap: text, orgId: auth.orgId },
  });

  if (shareWithParents) {
    await db.announcement.create({
      data: {
        orgId: auth.orgId,
        batchId,
        kind: "RECAP",
        authorId: auth.session.id,
        title: `Session recap · ${auth.batch.name}`,
        message: text,
      },
    });
  }

  refresh();
  return { success: true };
}

/** Coach → parents of one batch broadcast. */
export async function broadcastToBatch(batchId: string, title: string, message: string): Promise<Result> {
  const auth = await ownedBatch(batchId);
  if ("error" in auth) return { success: false, error: auth.error as string };
  const t = (title || "").trim().slice(0, 120);
  const m = (message || "").trim().slice(0, 2000);
  if (!t || !m) return { success: false, error: "Title and message are required." };

  await db.announcement.create({
    data: { orgId: auth.orgId, batchId, kind: "GENERAL", authorId: auth.session.id, title: t, message: m },
  });
  refresh();
  return { success: true };
}

/** Coach records the outcome of a trial kid in today's session; feeds the owner's lead pipeline. */
export async function recordTrialOutcome(
  trialId: string,
  outcome: "ATTENDED" | "NO_SHOW",
  feedback: string
): Promise<Result> {
  const session = await requireAuth(["COACH", "ADMIN"]);
  if (!session.orgId) return { success: false, error: "No academy found for your account." };

  const trial = await db.trialBooking.findFirst({
    where: {
      id: trialId,
      batch:
        session.role === "COACH"
          ? { orgId: session.orgId, coachId: session.id }
          : { orgId: session.orgId },
    },
    select: { id: true, parentPhone: true, childName: true, status: true },
  });
  if (!trial) return { success: false, error: "Trial not found." };
  if (trial.status === "ENROLLED") return { success: false, error: "This child is already enrolled." };

  await db.trialBooking.update({
    where: { id: trial.id },
    data: { status: outcome === "ATTENDED" ? "COMPLETED" : "NO_SHOW" },
  });

  // Update the matching lead (created when the trial was booked)
  const lead = await db.lead.findFirst({
    where: { orgId: session.orgId, parentPhone: trial.parentPhone, childName: trial.childName },
    orderBy: { createdAt: "desc" },
  });
  if (lead) {
    const note = (feedback || "").trim().slice(0, 500);
    const stamp = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
    await db.lead.update({
      where: { id: lead.id },
      data: {
        status: outcome === "ATTENDED" ? "TRIAL_ATTENDED" : lead.status,
        notes: [lead.notes, `[${stamp}] Coach: ${outcome === "ATTENDED" ? "Attended trial" : "No-show"}${note ? ` — ${note}` : ""}`]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  refresh();
  return { success: true };
}
