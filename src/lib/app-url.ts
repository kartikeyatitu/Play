// Public base URL of this deployment. Pure (no server-only imports) so client components can use it.
//
// Order: NEXT_PUBLIC_APP_URL → NEXT_PUBLIC_SITE_URL → https://${VERCEL_PROJECT_PRODUCTION_URL}
// (Vercel system env; the NEXT_PUBLIC_ twin is what Vercel exposes to the browser bundle for Next.js)
// → the browser's own origin → http://localhost:3000.
//
// Each process.env access is written out literally so Next.js can inline the NEXT_PUBLIC_ ones.
export function getAppUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    host(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    host(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL),
    typeof window !== "undefined" ? window.location.origin : undefined,
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

/** Host part only ("sportsos-tau.vercel.app"), for display text. */
export function getAppHost(): string {
  return getAppUrl().replace(/^https?:\/\//, "");
}

function host(v: string | undefined): string | undefined {
  const t = v?.trim();
  if (!t) return undefined;
  return /^https?:\/\//.test(t) ? t : `https://${t}`;
}
