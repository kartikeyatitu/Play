"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function broadcastAnnouncement(title: string, message: string, _adminId: string) {
    const session = await requireAuth(['ADMIN']);
  if (!title || !message) return { error: "Missing fields" };
  if (!session.orgId) return { error: "No organization found" };
  
  await db.announcement.create({ data: { orgId: session.orgId, 
      title,
      message,
      authorId: session.id // never trust the client-supplied adminId
    }
  });

  revalidatePath("/org");
  revalidatePath("/parent");
  return { success: true };
}
