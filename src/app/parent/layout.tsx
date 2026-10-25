import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { OrgLocaleProvider } from "@/lib/org-locale-context";
import type { OrgLocale } from "@/lib/i18n";

/**
 * A parent's "org" is the academy their child is enrolled at. Parents have
 * session.orgId set when they log in through an academy-issued link.
 */
export default async function ParentLayout({ children }: { children: ReactNode }) {
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
      console.warn("[parent/layout] failed to load org locale", err);
    }
  }
  return <OrgLocaleProvider value={locale}>{children}</OrgLocaleProvider>;
}
