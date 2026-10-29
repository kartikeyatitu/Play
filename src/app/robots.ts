import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/directory";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated app areas, internal ops and APIs are never indexed.
        disallow: ["/api/", "/org", "/coach", "/staff", "/parent", "/student", "/ops", "/onboarding", "/auth", "/login", "/delete-account", "/r/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
