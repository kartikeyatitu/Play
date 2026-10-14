// Server actions can't rely on thrown errors: Next.js replaces the message with a generic one in
// production. Actions wrap their body with `attempt` and return { ok: false, error } instead.

export type ActionResult<T extends object = {}> = ({ ok: true } & T) | { ok: false; error: string };

const INTERNAL = /prisma|invocation|database|ECONN|timeout|relation .* does not exist/i;

export async function attempt<T extends object>(fn: () => Promise<T>, tag = "action"): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) } as ActionResult<T>;
  } catch (e: any) {
    // Next.js redirects/notFound are thrown on purpose and must keep propagating
    if (typeof e?.digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND)/.test(e.digest)) throw e;
    const raw = typeof e?.message === "string" ? e.message : "";
    const safe = raw && raw.length < 200 && !INTERNAL.test(raw);
    if (!safe) console.error(`[triq:${tag}]`, e);
    return { ok: false, error: safe ? raw : "Something went wrong. Please try again." };
  }
}

/** Client side: turn a failed result back into a thrown Error (whose message is kept in the browser). */
export function unwrap<T extends object>(res: ActionResult<T>): { ok: true } & T {
  if (!res.ok) throw new Error(res.error);
  return res;
}
