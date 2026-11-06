"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { isPrivateAnalyticsPath } from "@/lib/analytics-privacy";

export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        try {
          const path = new URL(event.url).pathname;
          // Drop private pages entirely, and strip query strings (tokens such as ?t= share links) from the rest.
          if (isPrivateAnalyticsPath(path)) return null;
          const url = new URL(event.url);
          url.search = "";
          return { ...event, url: url.toString() };
        } catch {
          return null;
        }
      }}
    />
  );
}
