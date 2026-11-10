// "Aarav has arrived at U-12 nets" for parents, sent once when a child is first marked present or late.
// WhatsApp Business API only (approved template); respects the parent's Attendance setting.
// Server-only. Never throws.
import { db } from "@/lib/db";
import { sendMessage } from "@/lib/messaging";
import { whatsappProvider } from "@/lib/messaging/providers";

export const ARRIVAL_RELATED = "ARRIVAL";
const template = () => process.env.WHATSAPP_ARRIVAL_TEMPLATE || "child_arrived";
const first = (n: string | null | undefined) => (n || "").trim().split(/\s+/)[0] || "";

export function arrivalTime(now = new Date(), tz = "Asia/Kolkata"): string {
  return now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
}

export async function notifyArrivals(orgId: string, sessionId: string, studentIds: string[], now = new Date()) {
  if (!whatsappProvider.enabled || studentIds.length === 0) return;
  try {
    const [session, students] = await Promise.all([
      db.session.findUnique({ where: { id: sessionId }, select: { batch: { select: { name: true, org: { select: { timezone: true } } } } } }),
      db.student.findMany({
        where: { id: { in: studentIds }, orgId },
        select: { id: true, name: true, parent: { select: { id: true, name: true, phone: true } } },
      }),
    ]);
    if (!session) return;
    const at = arrivalTime(now, session.batch.org?.timezone || "Asia/Kolkata");
    for (const s of students) {
      if (!s.parent?.phone) continue;
      await sendMessage({
        channel: "WHATSAPP",
        category: "ATTENDANCE",
        to: s.parent.phone,
        template: template(),
        params: [first(s.parent.name) || "Parent", first(s.name), session.batch.name, at],
        orgId,
        userId: s.parent.id,
        relatedType: ARRIVAL_RELATED,
        relatedId: `${sessionId}:${s.id}`,
        idempotencyKey: `arrival:${sessionId}:${s.id}`,
      }).catch((e) => console.error("arrival: send failed", e instanceof Error ? e.message : e));
    }
  } catch (e) {
    console.error("arrival: failed", e instanceof Error ? e.message : e);
  }
}
