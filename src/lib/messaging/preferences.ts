// Notification preferences: pure rules, client-safe.
//
// Default is ON for every channel and category. FEES and SAFETY can never be switched off (fee notices
// and safety alerts such as SOS / incidents must always reach the guardian).

import type { MessageChannel, NotificationCategory } from "./types";

export const ALWAYS_ON_CATEGORIES: readonly NotificationCategory[] = ["FEES", "SAFETY"];

/** Categories shown on the settings page, in order. SAFETY is not shown (always on). */
export const PREFERENCE_CATEGORIES: { key: NotificationCategory; label: string; hint: string; locked?: boolean }[] = [
  { key: "FEES", label: "Fees", hint: "Due dates, receipts and payment confirmations. Always on.", locked: true },
  { key: "ATTENDANCE", label: "Attendance", hint: "Absence alerts and session reminders." },
  { key: "MATCHES", label: "Matches", hint: "Fixtures, results and event reminders." },
  { key: "PROGRESS", label: "Progress", hint: "Skill reports and monthly progress." },
  { key: "REWARDS", label: "Rewards", hint: "Points, badges and milestones." },
  { key: "ACADEMY_NEWS", label: "Academy news", hint: "Announcements from your academy." },
];

/** Channels shown on the settings page. EMAIL is listed but not sent yet (no email vendor approved). */
export const PREFERENCE_CHANNELS: { key: MessageChannel; label: string; available: boolean }[] = [
  { key: "WHATSAPP", label: "WhatsApp", available: true },
  { key: "EMAIL", label: "Email", available: false },
];

export function isAlwaysOn(category: NotificationCategory): boolean {
  return ALWAYS_ON_CATEGORIES.includes(category);
}

export interface PreferenceRow {
  channel: string;
  category: string;
  enabled: boolean;
}

/** Decide from stored rows: always-on categories win, then an explicit row, then default ON. */
export function resolvePreference(rows: PreferenceRow[], channel: MessageChannel, category: NotificationCategory): boolean {
  if (isAlwaysOn(category)) return true;
  const row = rows.find((r) => r.channel === channel && r.category === category);
  return row ? row.enabled : true;
}

/** Full grid for the settings page. */
export function preferenceGrid(rows: PreferenceRow[]): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const ch of PREFERENCE_CHANNELS) {
    out[ch.key] = {};
    for (const c of PREFERENCE_CATEGORIES) out[ch.key][c.key] = resolvePreference(rows, ch.key, c.key);
  }
  return out;
}

/**
 * Rows to upsert from a submitted form (checkbox "pref:<CHANNEL>:<CATEGORY>" present = on).
 * Always-on categories are never written as disabled.
 */
export function preferencesFromForm(present: Set<string>): { channel: MessageChannel; category: NotificationCategory; enabled: boolean }[] {
  const out: { channel: MessageChannel; category: NotificationCategory; enabled: boolean }[] = [];
  for (const ch of PREFERENCE_CHANNELS) {
    for (const c of PREFERENCE_CATEGORIES) {
      if (isAlwaysOn(c.key)) continue;
      out.push({ channel: ch.key, category: c.key, enabled: present.has(`pref:${ch.key}:${c.key}`) });
    }
  }
  return out;
}
