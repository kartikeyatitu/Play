"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FEATURES } from "@/lib/features";
import {
  acceptEventWaitlistOffer,
  getEventWaitlistForFamily,
  joinEventWaitlist,
  leaveEventWaitlist,
} from "@/app/actions/event-waitlist";

type State = Awaited<ReturnType<typeof getEventWaitlistForFamily>>;

/** Parent view of one child's place on an event waitlist: join when full, position, and any offer. */
export function EventWaitlistFamily({ eventId, studentId, currentStatus }: { eventId: string; studentId: string; currentStatus: string }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!FEATURES.eventWaitlist) return;
    try {
      setState(await getEventWaitlistForFamily(eventId, studentId));
    } catch {
      setState(null);
    }
  }, [eventId, studentId]);

  useEffect(() => {
    void load();
  }, [load, currentStatus]);

  if (!FEATURES.eventWaitlist || !state || !state.enabled || "error" in state) return null;

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    if (!r.success) setError(r.error ?? "Something went wrong.");
    await load();
    router.refresh();
    setBusy(false);
  }

  const going = (state.rsvpStatus ?? currentStatus) === "GOING";
  if (going || !state.upcoming) return null;

  let body: React.ReactNode = null;
  if (state.status === "OFFERED" && state.offerExpiresAt) {
    const until = new Date(state.offerExpiresAt).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" });
    body = (
      <>
        <span className="text-lime-300">A place is free. Accept by {until}.</span>
        <Button size="sm" disabled={busy} onClick={() => run(() => acceptEventWaitlistOffer(eventId, studentId))} className="h-8">
          Accept place
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => leaveEventWaitlist(eventId, studentId))} className="h-8 border-zinc-700">
          Decline
        </Button>
      </>
    );
  } else if (state.status === "WAITING" && state.position) {
    body = (
      <>
        <span className="text-zinc-300">
          Waitlist: #{state.position} of {state.waiting}
        </span>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => leaveEventWaitlist(eventId, studentId))} className="h-8 border-zinc-700">
          Leave waitlist
        </Button>
      </>
    );
  } else if (state.full) {
    body = (
      <>
        <span className="text-amber-300">This event is full.</span>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => joinEventWaitlist(eventId, studentId))} className="h-8 border-zinc-700">
          Join waitlist{state.waiting ? ` (${state.waiting} waiting)` : ""}
        </Button>
      </>
    );
  }
  if (!body) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs mt-2" aria-live="polite">
      {busy && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
      {body}
      {error && <span className="text-rose-400 w-full">{error}</span>}
    </div>
  );
}
