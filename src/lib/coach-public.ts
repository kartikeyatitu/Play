// Rules for the public coach page /c/[coachId]. Pure and client-safe.

/**
 * Whether a coach page may be indexed by search engines / listed in the sitemap.
 * While Coach OS is off the page stays reachable (links are already shared on WhatsApp)
 * but is noindex and absent from the sitemap.
 */
export function shouldIndexCoach(opts: { coachOS: boolean; verified: boolean }): boolean {
  return opts.coachOS && opts.verified;
}
