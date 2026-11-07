import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { getMyNotificationPreferences } from "@/app/actions/notification-prefs";
import { PreferencesForm } from "@/components/notifications/PreferencesForm";
import { Card, Flash, Page } from "@/components/verticals/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications | Triq", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NotificationSettingsPage({ searchParams }: { searchParams: SP }) {
  if (!FEATURES.messageDelivery) notFound();
  await requireAuth();
  const sp = await searchParams;
  const prefs = await getMyNotificationPreferences();

  return (
    <Page eyebrow="Settings" title="Notifications">
      <Flash error={sp.error} saved={sp.saved ? "Preferences saved." : undefined} />
      <Card>
        {prefs.ok ? <PreferencesForm grid={prefs.grid} /> : <p className="text-sm text-rose-300">{prefs.error}</p>}
      </Card>
    </Page>
  );
}
