import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { OrgLocaleProvider } from "@/lib/org-locale-context";
import type { OrgLocale } from "@/lib/i18n";

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  let locale: OrgLocale | null = null;
  if (session?.orgId) {
    try {
      locale = await db.organization.findUnique({
        where: { id: session.orgId },
        select: {
          country: true,
          currency: true,
          timezone: true,
          locale: true,
          phoneCountry: true,
        },
      });
    } catch (err) {
      console.warn("[coach/layout] failed to load org locale", err);
    }
  }
  return <OrgLocaleProvider value={locale}>{children}</OrgLocaleProvider>;
}
