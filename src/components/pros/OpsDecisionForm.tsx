import { OPS_DECISION_LABELS, availableOpsDecisions } from "@/lib/pros/verification";
import { fieldCls, primaryBtn } from "./ui";

/** Ops-only: verify, mark reviewed, reject or revoke. Reject and revoke need a reason (checked server-side too). */
export function OpsDecisionForm({ action, id, from }: { action: (fd: FormData) => Promise<void>; id: string; from: string }) {
  const decisions = availableOpsDecisions(from);
  if (!decisions.length) return null;
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="decision" aria-label="Decision" required className={`${fieldCls} w-auto`} defaultValue="">
        <option value="" disabled>
          Choose a decision
        </option>
        {decisions.map((d) => (
          <option key={d} value={d}>
            {OPS_DECISION_LABELS[d]}
          </option>
        ))}
      </select>
      <input name="reason" maxLength={300} aria-label="Reason" placeholder="Reason (required to reject or revoke)" className={`${fieldCls} min-w-0 flex-1`} />
      <button className={primaryBtn}>Record decision</button>
    </form>
  );
}
