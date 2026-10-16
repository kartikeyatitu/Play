// Server only: wraps a server action body and turns thrown errors into an ActionResult.
// Kept apart from action-result.ts so client components importing `unwrap` never pull in Sentry's
// server SDK. Only import this from "use server" modules.
import * as Sentry from "@sentry/nextjs";
import type { ActionResult } from "@/lib/action-result";

const INTERNAL = /prisma|invocation|database|ECONN|timeout|relation .* does not exist/i;

export async function attempt<T extends object>(fn: () => Promise<T>, tag = "action"): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) } as ActionResult<T>;
  } catch (e: any) {
    // Next.js redirects/notFound are thrown on purpose and must keep propagating
    if (typeof e?.digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND)/.test(e.digest)) throw e;
    const raw = typeof e?.message === "string" ? e.message : "";
    const safe = raw && raw.length < 200 && !INTERNAL.test(raw);
    if (!safe) {
      console.error(`[triq:${tag}]`, e);
      // Unexpected failure (DB, network, bug). A no-op while Sentry isn't initialised (no SENTRY_DSN).
      Sentry.captureException(e, { tags: { action: tag } });
    }
    return { ok: false, error: safe ? raw : "Something went wrong. Please try again." };
  }
}
