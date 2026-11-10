/**
 * Pages that can show children's or families' information. Web analytics never records these
 * (master plan risk 4: no analytics on child pages). Matching is on the path prefix.
 */
export const PRIVATE_ANALYTICS_PREFIXES = [
  "/parent", "/parents", "/student", "/athlete", "/coach", "/org", "/staff", "/ops", "/live", "/r",
  "/join", "/delete-account", "/onboarding", "/rewards", "/gallery", "/family", "/consent", "/mind", "/body", "/pros/dashboard", "/story", "/pay",
] as const;

/** True when a pathname is, or is under, one of the private prefixes. */
export function isPrivateAnalyticsPath(pathname: string): boolean {
  return PRIVATE_ANALYTICS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
