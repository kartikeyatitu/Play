"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function sendMessage(_senderId: string, receiverId: string, content: string) {
    const session = await requireAuth();
  if (!content || !content.trim()) return { error: "Message is empty" };
  if (!session.orgId) return { error: "Your account is not linked to an academy" };

  // Never trust senderId from the client — always send as the logged-in user.
  const senderId = session.id as string;

  // Verify both users exist (prevents FK violation after DB reset)
  const sender = await db.user.findUnique({ where: { id: senderId } });
  // Tenant scope: recipient must belong to the same academy. Parents can only write to staff,
  // never to other parents (their phone numbers / children are private to each family).
  const receiver = await db.user.findFirst({
    where: {
      id: receiverId,
      orgId: session.orgId,
      ...(session.role === "PARENT" ? { role: { in: ["ADMIN", "COACH"] } } : {}),
    },
  });
  
  if (!sender) return { error: "Session expired. Please logout and login again." };
  if (!receiver) return { error: "Recipient not found." };
  if (content.length > 4000) return { error: "Message is too long" };

  try {
    await db.message.create({
      data: { senderId, receiverId: receiver.id, content, orgId: session.orgId }
    });
  } catch (e: any) {
    console.error("Chat error:", e);
    return { error: "Failed to send message" };
  }

  revalidatePath("/org");
  revalidatePath("/coach");
  revalidatePath("/parent");
  
  return { success: true };
}
