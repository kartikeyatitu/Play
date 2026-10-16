// Product analytics (PostHog), browser only. Completely off unless NEXT_PUBLIC_POSTHOG_KEY is set:
// posthog-js is loaded with a dynamic import, so without a key it is never downloaded and
// `track()` is a no-op.
//
// Privacy: anonymous events only (person_profiles "identified_only" and we never identify), no
// session recording, no input/change autocapture, element text and attributes masked, URLs reduced
// to their path with long ids/tokens replaced. Event properties are typed below: never add names,
// phone numbers or money amounts to them.

import type { PostHog } from "posthog-js";

/** Every event we send, with the only properties it may carry. */
export interface AnalyticsEvents {
  payout_marked_paid: { payment_mode: string; pay_type: string };
  expense_added: { category: string; payment_mode: string };
  team_member_added: { role: string; staff_role: string | null; joined_other_academy: boolean };
  staff_checked_in: { surface: "staff_home" | "coach_card" };
  parent_whatsapp_clicked: { surface: "today_absent" };
}

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let loading: Promise<PostHog | null> | null = null;

const URL_PROPS = ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer", "$session_entry_url", "$session_entry_referrer"];
const PATH_PROPS = ["$pathname", "$prev_pageview_pathname", "$initial_pathname", "$session_entry_pathname"];

/** "/r/abc123…?phone=…#x" → "/r/:id": drops query/hash and masks token-like or long numeric segments. */
function cleanPath(path: string): string {
  return path
    .split("/")
    .map((seg) => (/^[A-Za-z0-9_-]{16,}$/.test(seg) || /^\d{6,}$/.test(seg) ? ":id" : seg))
    .join("/");
}

function cleanUrl(value: unknown): unknown {
  if (typeof value !== "string" || !value) return value;
  try {
    const u = new URL(value);
    return `${u.origin}${cleanPath(u.pathname)}`;
  } catch {
    return cleanPath(value.split(/[?#]/)[0]);
  }
}

function cleanProps(props: Record<string, any> | undefined) {
  if (!props) return;
  for (const k of URL_PROPS) if (k in props) props[k] = cleanUrl(props[k]);
  for (const k of PATH_PROPS) if (typeof props[k] === "string") props[k] = cleanPath(props[k].split(/[?#]/)[0]);
}

export function analyticsEnabled(): boolean {
  return Boolean(KEY) && typeof window !== "undefined";
}

/** Loads and initialises PostHog once. Resolves to null when analytics is off or fails to load. */
export function initAnalytics(): Promise<PostHog | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  loading ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        person_profiles: "identified_only",
        capture_pageview: "history_change", // App Router client-side navigations
        disable_session_recording: true,
        autocapture: { dom_event_allowlist: ["click", "submit"] }, // no "change": inputs are never autocaptured
        mask_all_text: true,
        mask_all_element_attributes: true, // also drops hrefs, e.g. wa.me links with phone + message
        mask_personal_data_properties: true,
        enable_heatmaps: false,
        capture_dead_clicks: false,
        capture_exceptions: false, // Sentry handles errors
        disable_surveys: true,
        disable_external_dependency_loading: true, // no extra scripts from PostHog's CDN
        before_send: (event) => {
          if (event) {
            cleanProps(event.properties);
            cleanProps(event.$set);
            cleanProps(event.$set_once);
          }
          return event;
        },
      });
      return posthog;
    })
    .catch(() => null);
  return loading;
}

/** Send a product event. No-op when analytics is off; never throws. */
export function track<E extends keyof AnalyticsEvents>(event: E, props: AnalyticsEvents[E]): void {
  if (!analyticsEnabled()) return;
  void initAnalytics()
    .then((posthog) => posthog?.capture(event, props))
    .catch(() => {});
}
