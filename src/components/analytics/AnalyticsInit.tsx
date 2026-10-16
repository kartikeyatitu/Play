"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/** Starts PostHog after hydration when NEXT_PUBLIC_POSTHOG_KEY is set. Renders nothing. */
export function AnalyticsInit() {
  useEffect(() => {
    void initAnalytics();
  }, []);
  return null;
}
