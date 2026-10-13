"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

// PARENT added: called from the parent dashboard (FeedbackWidget).
export async function submitFeedback(
  parentId: string,
  rating: number,
  comment: string
) {
    const session = await requireAuth(['ADMIN', 'PARENT']);
  try {
    // Never trust parentId: parents submit as themselves; admins may record for a parent in their academy
    let resolvedParentId: string | null = null;
    if (session.role === "PARENT") {
      resolvedParentId = session.id;
    } else if (parentId) {
      const parent = await db.user.findFirst({ where: { id: parentId, orgId: session.orgId || "__no_org__" }, select: { id: true } });
      resolvedParentId = parent?.id ?? null;
    }
    if (!resolvedParentId) return { success: false, error: "Parent not found" };
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { success: false, error: "Rating must be between 1 and 5" };
    comment = comment ? String(comment).slice(0, 1000) : comment;

    const feedback = await db.feedback.create({
      data: {
        parentId: resolvedParentId,
        rating,
        comment: comment || null,
        orgId: session.orgId,
      },
    });
    revalidatePath("/parent/feedback");
    return { success: true, data: feedback };
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return { success: false, error: "Failed to submit feedback" };
  }
}
