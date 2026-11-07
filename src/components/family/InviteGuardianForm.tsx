"use client";

import { useActionState } from "react";
import { inviteSecondGuardianForm } from "@/app/actions/guardians";

const field = "min-h-12 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 text-base text-zinc-100";

/** Owner flow: add a second guardian to a child by phone and share a one-tap login link. */
export function InviteGuardianForm({ students }: { students: { id: string; name: string; batch: string | null }[] }) {
  const [state, action, pending] = useActionState(inviteSecondGuardianForm, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-400">Child</span>
        <select name="studentId" required className={field} defaultValue="">
          <option value="" disabled>
            Choose a child
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.batch ? ` · ${s.batch}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-400">Guardian&apos;s name</span>
        <input name="name" required autoComplete="off" className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-400">Mobile number</span>
        <input name="phone" type="tel" inputMode="tel" required placeholder="98765 43210" className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-400">Relation</span>
        <select name="relation" className={field} defaultValue="MOTHER">
          <option value="MOTHER">Mother</option>
          <option value="FATHER">Father</option>
          <option value="GUARDIAN">Guardian</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-rose-300">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <div role="status" className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          <p>
            {state.guardianName} is now a guardian of {state.childName}.
          </p>
          {state.whatsappUrl ? (
            <a href={state.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-lg bg-emerald-500 font-semibold text-zinc-950">
              Send login link on WhatsApp
            </a>
          ) : null}
          <p className="text-xs text-emerald-200/80">The link signs them in once and expires in 7 days.</p>
        </div>
      ) : null}
      <button type="submit" disabled={pending} className="min-h-12 w-full rounded-lg bg-lime-400 text-sm font-semibold text-zinc-950 disabled:opacity-60">
        {pending ? "Adding…" : "Add guardian"}
      </button>
    </form>
  );
}
