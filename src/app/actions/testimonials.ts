"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function getTestimonials() {
    const session = await requireAuth(['ADMIN', 'COACH']);
  try {
    const orgId = session.orgId || "__no_org__";
    // Tenant scope: legacy feedback rows may have orgId = null, so also match via the parent's org
    const feedback = await db.feedback.findMany({
      where: { OR: [{ orgId }, { orgId: null, parent: { orgId } }] },
      include: {
        parent: {
          select: {
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    return feedback;
  } catch (error) {
    console.error("Failed to fetch testimonials:", error);
    return [];
  }
}

export async function addTestimonial(data: { parentId: string; rating: number; comment: string }) {
    const session = await requireAuth(['ADMIN', 'PARENT']);
  try {
    // Never trust parentId: parents submit as themselves; admins may record for a parent in their academy
    let parentId: string | null = null;
    if (session.role === "PARENT") {
      parentId = session.id;
    } else if (data?.parentId) {
      const parent = await db.user.findFirst({ where: { id: data.parentId, orgId: session.orgId || "__no_org__" }, select: { id: true } });
      parentId = parent?.id ?? null;
    }
    if (!parentId) return { success: false, error: "Parent not found" };
    if (!Number.isInteger(data?.rating) || data.rating < 1 || data.rating > 5) return { success: false, error: "Rating must be between 1 and 5" };

    const feedback = await db.feedback.create({
      data: {
        parentId,
        rating: data.rating,
        comment: data.comment,
        orgId: session.orgId,
      }
    });
    revalidatePath("/org");
    return { success: true, feedback };
  } catch (error) {
    console.error("Failed to add testimonial:", error);
    return { success: false, error: "Failed to add testimonial" };
  }
}
