// Server actions can't rely on thrown errors: Next.js replaces the message with a generic one in
// production. Actions wrap their body with `attempt` (src/lib/action-attempt.ts, server only) and
// return { ok: false, error } instead.
//
// Client components import `unwrap` from here, so this file must stay free of server-only imports
// (e.g. the Sentry server SDK used by `attempt`).

export type ActionResult<T extends object = {}> = ({ ok: true } & T) | { ok: false; error: string };

/** Client side: turn a failed result back into a thrown Error (whose message is kept in the browser). */
export function unwrap<T extends object>(res: ActionResult<T>): { ok: true } & T {
  if (!res.ok) throw new Error(res.error);
  return res;
}
