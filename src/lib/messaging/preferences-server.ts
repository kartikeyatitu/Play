// shouldSend(userId, channel, category): the send-time preference check. Server-only.
// While FEATURES.messageDelivery is off, the NotificationPreference table is never queried and the
// defaults apply (everything on).

import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { isAlwaysOn, resolvePreference, type PreferenceRow } from "./preferences";
import type { MessageChannel, NotificationCategory } from "./types";

export async function loadPreferenceRows(userId: string): Promise<PreferenceRow[]> {
  if (!FEATURES.messageDelivery || !userId) return [];
  return db.notificationPreference.findMany({ where: { userId }, select: { channel: true, category: true, enabled: true } });
}

export async function shouldSend(userId: string | null | undefined, channel: MessageChannel, category: NotificationCategory): Promise<boolean> {
  if (isAlwaysOn(category)) return true;
  if (!userId || !FEATURES.messageDelivery) return true;
  try {
    const row = await db.notificationPreference.findUnique({
      where: { userId_channel_category: { userId, channel, category } },
      select: { channel: true, category: true, enabled: true },
    });
    return resolvePreference(row ? [row] : [], channel, category);
  } catch (e) {
    // Fail open for a preference read error: a missed lookup must not silently drop messages.
    console.error("shouldSend: preference lookup failed", e instanceof Error ? e.message : e);
    return true;
  }
}
