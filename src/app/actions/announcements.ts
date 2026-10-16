"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";

export async function broadcastAnnouncement(title: string, message: string, _adminId: string) {
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { error: auth.error };
  const { session } = auth;
  if (!title || !message) return { error: "Missing fields" };
  
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
