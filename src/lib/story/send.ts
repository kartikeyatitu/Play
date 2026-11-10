// Sunday evening: each family gets a WhatsApp link to their child's week (WhatsApp Business API only).
// Server-only; called by the CRON_SECRET-protected route. Without the API configured it does nothing:
// families still see "<child>'s week" on their home screen.
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { localDateString } from "@/lib/fee-aging";
import { registerRetryResolver, sendMessage } from "@/lib/messaging";
import { whatsappProvider } from "@/lib/messaging/providers";
import { mondayOf, addDays } from "./weekly";

export const WEEKLY_STORY_RELATED = "WEEKLY_STORY";
const template = () => process.env.WHATSAPP_WEEKLY_STORY_TEMPLATE || "weekly_story";
const first = (n: string | null | undefined) => (n || "").trim().split(/\s+/)[0] || "";

/** Children who had at least one session this week, with the guardian to message (primary parent). */
async function storyRecipients(orgId: string, weekStart: string) {
  const from = new Date(`${weekStart}T00:00:00Z`);
  const to = new Date(`${addDays(weekStart, 7)}T00:00:00Z`);
  const rows = await db.attendance.findMany({
    where: { session: { batch: { orgId }, date: { gte: from, lt: to }, status: { not: "CANCELLED" } }, student: { orgId } },
    select: { student: { select: { id: true, name: true, parent: { select: { id: true, name: true, phone: true } } } } },
    distinct: ["studentId"],
  });
  return rows.map((r) => r.student).filter((s) => s.parent?.phone);
}

/** Payload for one child, rebuilt fresh (also used by retries). `relatedId` is "<orgId>:<studentId>:<weekStart>". */
async function payloadFor(relatedId: string) {
  const [orgId, studentId, weekStart] = relatedId.split(":");
  if (!orgId || !studentId || !weekStart) return null;
  const s = await db.student.findFirst({
    where: { id: studentId, orgId },
    select: { id: true, name: true, org: { select: { name: true } }, parent: { select: { id: true, name: true, phone: true } } },
  });
  if (!s?.parent?.phone) return null;
  return {
    to: s.parent.phone,
    userId: s.parent.id,
    category: "PROGRESS" as const,
    template: template(),
    params: [first(s.parent.name) || "Parent", first(s.name), `${getAppUrl()}/story/${s.id}?w=${weekStart}`, s.org?.name || "your academy"],
  };
}

registerRetryResolver(WEEKLY_STORY_RELATED, payloadFor);

export async function sendWeeklyStories(now = new Date()) {
  const summary = { orgs: 0, sent: 0, skipped: 0, failed: 0, notConfigured: false };
  if (!whatsappProvider.enabled) return { ...summary, notConfigured: true };
  const orgs = await db.organization.findMany({ where: { isActive: true }, select: { id: true, timezone: true } });
  for (const org of orgs) {
    summary.orgs++;
    const weekStart = mondayOf(localDateString(now, org.timezone || "Asia/Kolkata"));
    let kids: Awaited<ReturnType<typeof storyRecipients>> = [];
    try {
      kids = await storyRecipients(org.id, weekStart);
    } catch (e) {
      console.error("weekly-story: recipients failed", org.id, e instanceof Error ? e.message : e);
      continue;
    }
    for (const k of kids) {
      const relatedId = `${org.id}:${k.id}:${weekStart}`;
      const p = await payloadFor(relatedId);
      if (!p) continue;
      try {
        const r = await sendMessage({
          channel: "WHATSAPP",
          category: p.category,
          to: p.to,
          template: p.template,
          params: p.params,
          orgId: org.id,
          userId: p.userId,
          relatedType: WEEKLY_STORY_RELATED,
          relatedId,
          idempotencyKey: `weekly-story:${relatedId}`,
        });
        if (r.status === "SENT" || r.status === "RETRYING") summary.sent++;
        else if (r.status === "SKIPPED") summary.skipped++;
        else summary.failed++;
      } catch (e) {
        summary.failed++;
        console.error("weekly-story: send failed", e instanceof Error ? e.message : e);
      }
    }
  }
  return summary;
}
