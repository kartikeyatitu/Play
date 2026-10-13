"use server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Any logged-in role may read their OWN notifications. The userId argument is ignored
// (untrusted) — notifications are always for the session user.
export async function getUnreadCount(_userId?: string) {
    const session = await requireAuth();
  // Count messages where receiverId = userId that were sent in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await db.message.count({
    where: { receiverId: session.id, createdAt: { gte: oneDayAgo } },
  });
  return count;
}

export async function getRecentNotifications(_userId?: string) {
    const session = await requireAuth();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const messages = await db.message.findMany({
    where: { receiverId: session.id, createdAt: { gte: oneDayAgo } },
    // Only expose the sender's display fields (not phone/email/password hash)
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return messages;
}
