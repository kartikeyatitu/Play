import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { OrgLocaleProvider } from "@/lib/org-locale-context";
import type { OrgLocale } from "@/lib/i18n";

/**
 * Loads the admin's org locale once per request and provides it to every
 * client component under /org via useOrgLocale(), useFormatMoney(), etc.
 *
 * No auth gating here — individual /org pages run their own requireAuth(["ADMIN"])
 * so this layout stays liberal and never redirects on its own.
 */
export default async function OrgLayout({ children }: { children: ReactNode }) {
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
      // Non-fatal: if the DB call blips, fall back to defaults in the hooks.
      console.warn("[org/layout] failed to load org locale", err);
    }
  }

  return <OrgLocaleProvider value={locale}>{children}</OrgLocaleProvider>;
}
