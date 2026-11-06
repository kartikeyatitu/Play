import { actOnProsBooking } from "@/app/actions/pros";
import { availableActions, type AppointmentActor } from "@/lib/wellness";
import { dangerBtn, fieldCls, ghostBtn, primaryBtn } from "./ui";

const LABELS = { CONFIRM: "Confirm", DECLINE: "Decline", COMPLETE: "Mark completed", CANCEL: "Cancel" } as const;

/** Buttons for the actions this party may take now (same state machine as Wellness). */
export function BookingActions({
  id,
  status,
  actor,
  scheduledAt,
  now,
}: {
  id: string;
  status: string;
  actor: AppointmentActor;
  scheduledAt: Date;
  now: Date;
}) {
  const actions = availableActions(status, actor, { now, scheduledAt });
  if (!actions.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {actions
        .filter((a) => a !== "CANCEL")
        .map((a) => (
          <form key={a} action={actOnProsBooking}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value={a} />
            <button className={a === "CONFIRM" ? primaryBtn : ghostBtn}>{LABELS[a]}</button>
          </form>
        ))}
      {actions.includes("CANCEL") && (
        <form action={actOnProsBooking} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value="CANCEL" />
          <input name="reason" maxLength={300} placeholder="Reason (optional, no medical details)" className={`${fieldCls} w-64 max-w-full`} />
          <button className={dangerBtn}>Cancel</button>
        </form>
      )}
    </div>
  );
}
