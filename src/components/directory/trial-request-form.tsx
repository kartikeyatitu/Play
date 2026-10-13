"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { requestTrial, type DirectoryActionState } from "@/app/academies/actions";
import { sportName } from "@/lib/directory";
import { Field, Honeypot, PhoneInput, inputClass } from "./form-fields";

export function TrialRequestForm({
  listedAcademyId,
  academyName,
  sports,
  defaultSport,
}: {
  listedAcademyId: string;
  academyName: string;
  sports: string[];
  defaultSport?: string;
}) {
  const [state, formAction, pending] = useActionState<DirectoryActionState, FormData>(requestTrial, null);
  const lastNonce = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state || state.nonce === lastNonce.current) return;
    lastNonce.current = state.nonce;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="text-base font-semibold text-white">Request sent</p>
        <p className="max-w-xs text-sm text-zinc-400">{state.message}</p>
      </div>
    );
  }

  const err = state?.errors ?? {};

  return (
    <form
      noValidate
      className="relative space-y-3.5"
      onSubmit={(e) => {
        // Manual dispatch (instead of action=) so React doesn't reset fields on validation errors.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <input type="hidden" name="listedAcademyId" value={listedAcademyId} />
      <Honeypot id="trial-hp" />

      <Field label="Parent name" htmlFor="trial-parentName" error={err.parentName}>
        <input
          id="trial-parentName"
          name="parentName"
          autoComplete="name"
          required
          maxLength={80}
          placeholder="Your name"
          aria-invalid={err.parentName ? true : undefined}
          className={inputClass}
        />
      </Field>

      <Field label="WhatsApp number" htmlFor="trial-phone" error={err.phone}>
        <PhoneInput id="trial-phone" name="phone" error={err.phone} />
      </Field>

      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
        <Field label="Child's name" htmlFor="trial-childName" error={err.childName} optional>
          <input id="trial-childName" name="childName" maxLength={80} placeholder="e.g. Aarav" className={inputClass} />
        </Field>
        <Field label="Age" htmlFor="trial-childAge" error={err.childAge}>
          <input
            id="trial-childAge"
            name="childAge"
            type="number"
            inputMode="numeric"
            min={3}
            max={25}
            placeholder="9"
            aria-invalid={err.childAge ? true : undefined}
            className={inputClass}
          />
        </Field>
      </div>

      {sports.length > 1 && (
        <Field label="Sport" htmlFor="trial-sport">
          <select id="trial-sport" name="sport" defaultValue={defaultSport ?? sports[0]} className={`${inputClass} appearance-none`}>
            {sports.map((s) => (
              <option key={s} value={s}>
                {sportName(s)}
              </option>
            ))}
          </select>
        </Field>
      )}
      {sports.length === 1 && <input type="hidden" name="sport" value={sports[0]} />}

      <Field label="Anything the coach should know?" htmlFor="trial-message" error={err.message} optional>
        <textarea
          id="trial-message"
          name="message"
          rows={2}
          maxLength={500}
          placeholder="Preferred days / timings, experience level…"
          className={`${inputClass} h-auto resize-none py-2.5`}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 text-[15px] font-semibold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        {pending ? "Sending…" : "Request free trial"}
      </button>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-500">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-zinc-600" />
        Free, no obligation. Your number is only shared with {academyName} to schedule the trial.
      </p>
    </form>
  );
}
