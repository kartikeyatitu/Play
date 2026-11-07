"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FEATURES } from "@/lib/features";
import { getEventWaitlistForOrganiser, offerNextEventPlaces, setEventWaitlistFull } from "@/app/actions/event-waitlist";

type State = Awaited<ReturnType<typeof getEventWaitlistForOrganiser>>;

const LABEL: Record<string, string> = { WAITING: "waiting", OFFERED: "offered", ACCEPTED: "accepted", EXPIRED: "expired" };

/** Organiser view of an event waitlist: mark full / reopen, offer the next place, and the list. */
export function EventWaitlistOrganiser({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!FEATURES.eventWaitlist) return;
    try {
      setState(await getEventWaitlistForOrganiser(eventId));
    } catch {
      setState(null);
    }
  }, [eventId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!FEATURES.eventWaitlist) return null;

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    if (!r.success) setError(r.error ?? "Something went wrong.");
    await load();
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] text-zinc-400 underline underline-offset-2">
        Waitlist
      </button>
    );
  }

  const ready = state && state.enabled && !("error" in state);
  return (
    <div className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-zinc-200">Waitlist</span>
        {ready && <span className={state.full ? "text-amber-300" : "text-zinc-400"}>{state.full ? "Marked full" : "Open"}</span>}
        {busy && <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />}
        <button type="button" onClick={() => setOpen(false)} className="ml-auto text-zinc-500">
          Close
        </button>
      </div>
      {!state && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
      {state && "error" in state && <p className="text-rose-400">{state.error}</p>}
      {ready && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} className="h-7 border-zinc-700" onClick={() => run(() => setEventWaitlistFull(eventId, !state.full))}>
              {state.full ? "Reopen (offer everyone waiting)" : "Mark full"}
            </Button>
            {state.full && (
              <Button size="sm" variant="outline" disabled={busy} className="h-7 border-zinc-700" onClick={() => run(() => offerNextEventPlaces(eventId, 1))}>
                Offer next place
              </Button>
            )}
          </div>
          {state.entries.length === 0 ? (
            <p className="text-zinc-500">Nobody on the waitlist.</p>
          ) : (
            <ol className="space-y-1">
              {state.entries.map((e) => (
                <li key={e.studentId} className="flex justify-between gap-2 text-zinc-300">
                  <span>
                    {e.position > 0 ? `#${e.position} ` : ""}
                    {e.name}
                  </span>
                  <span className="text-zinc-500">
                    {e.declined ? "declined / left" : LABEL[e.status] ?? e.status}
                    {e.status === "OFFERED" && e.offerExpiresAt
                      ? ` until ${new Date(e.offerExpiresAt).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                      : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {error && <p className="text-rose-400">{error}</p>}
        </>
      )}
    </div>
  );
}
