"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/membership";

export async function broadcastAnnouncement(title: string, message: string, _adminId: string) {
  const auth = await checkPermission("settings.manage");
  if (!auth.ok) return { error: auth.error };
  const { session } = auth;
  if (!title || !message) return { error: "Missing fields" };
  
  const created = await db.announcement.create({ data: { orgId: session.orgId, 
      title,
      message,
      authorId: session.id // never trust the client-supplied adminId
    }
  });
  await logAnnouncementPosted(session.id, session.orgId, created);

  revalidatePath("/org");
  revalidatePath("/parent");
  return { success: true };
}

async function logAnnouncementPosted(userId: string, orgId: string, a: { id: string; batchId: string | null; kind: string | null }) {
  try {
    await db.auditLog.create({
      data: {
        userId,
        orgId,
        action: "ANNOUNCEMENT_POSTED",
        details: JSON.stringify({ announcementId: a.id, batchId: a.batchId, kind: a.kind }),
      },
    });
  } catch {
    // Audit logging must never block the main action
  }
}
