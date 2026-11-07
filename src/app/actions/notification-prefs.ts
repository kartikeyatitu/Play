"use server";

// Notification preferences (NotificationPreference, flag FEATURES.messageDelivery). Exports only async
// functions. Fees and safety notices cannot be switched off.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { getSession } from "@/lib/auth";
import { rateLimitDb } from "@/lib/rate-limit";
import { preferenceGrid, preferencesFromForm } from "@/lib/messaging/preferences";
import { loadPreferenceRows } from "@/lib/messaging/preferences-server";

const PAGE = "/settings/notifications";
const OFF_ERROR = "Notification settings are not switched on yet.";

/** The signed-in user's full channel x category grid (defaults when the flag is off). */
export async function getMyNotificationPreferences(): Promise<
  { ok: true; enabled: boolean; grid: Record<string, Record<string, boolean>> } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session?.id) return { ok: false, error: "Please sign in again." };
  const rows = await loadPreferenceRows(session.id);
  return { ok: true, enabled: FEATURES.messageDelivery, grid: preferenceGrid(rows) };
}

/** Form post from the settings page: checkbox "pref:<CHANNEL>:<CATEGORY>" present = on. */
export async function saveNotificationPreferences(formData: FormData): Promise<void> {
  const fail = (msg: string): never => redirect(`${PAGE}?error=${encodeURIComponent(msg)}`);
  if (!FEATURES.messageDelivery) fail(OFF_ERROR);
  const session = await getSession();
  if (!session?.id) redirect("/login");
  const userId = session!.id;
  const rl = await rateLimitDb(`notif-prefs:${userId}`, 20, 60 * 60_000);
  if (!rl.allowed) fail("Too many changes. Please try again later.");

  const present = new Set<string>();
  for (const [k] of formData.entries()) if (k.startsWith("pref:")) present.add(k);
  const rows = preferencesFromForm(present);
  await db.$transaction(
    rows.map((r) =>
      db.notificationPreference.upsert({
        where: { userId_channel_category: { userId, channel: r.channel, category: r.category } },
        create: { userId, channel: r.channel, category: r.category, enabled: r.enabled },
        update: { enabled: r.enabled },
      }),
    ),
  );
  revalidatePath(PAGE);
  redirect(`${PAGE}?saved=1`);
}
