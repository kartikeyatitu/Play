"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2, Clock, Loader2, MessageCircle, LayoutDashboard, IndianRupee } from "lucide-react";
import { claimListing, type DirectoryActionState } from "@/app/academies/actions";
import { Field, Honeypot, PhoneInput, inputClass } from "./form-fields";

const PERKS = [
  { icon: MessageCircle, text: "Get trial requests from parents straight to your WhatsApp" },
  { icon: LayoutDashboard, text: "Show your batches, timings & fees — update anytime" },
  { icon: IndianRupee, text: "Run attendance & fee collection on Triq — free to start" },
];

export function ClaimListing({
  listedAcademyId,
  academyName,
  claimStatus,
}: {
  listedAcademyId: string;
  academyName: string;
  claimStatus: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<DirectoryActionState, FormData>(claimListing, null);
  const lastNonce = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state || state.nonce === lastNonce.current) return;
    lastNonce.current = state.nonce;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  const err = state?.errors ?? {};

  return (
    <section
      id="claim"
      aria-labelledby="claim-heading"
      className="relative overflow-hidden rounded-3xl border border-lime-400/25 bg-gradient-to-br from-lime-400/[0.09] via-zinc-900/70 to-zinc-900/60 p-5 sm:p-7"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-lime-400/10 blur-3xl" />

      <div className="relative">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-lime-300">
          <BadgeCheck className="size-3.5" /> For academy owners
        </p>
        <h2 id="claim-heading" className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Is this your academy? Claim it free
        </h2>
        <p className="mt-1.5 text-sm text-zinc-400">
          Take control of the {academyName} listing in 2 minutes. No card, no contract.
        </p>

        {claimStatus === "PENDING" && !state?.ok && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200/90">
            <Clock className="mt-px size-3.5 shrink-0" />
            A claim for this listing is being verified. If you&apos;re the owner and haven&apos;t applied, you can still submit — we verify every claim by phone.
          </p>
        )}

        <ul className="mt-4 space-y-2.5">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-sm text-zinc-300">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-lime-400/15 text-lime-300">
                <Icon className="size-3" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        {state?.ok ? (
          <div role="status" className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
            <p className="text-sm text-emerald-100/90">{state.message}</p>
          </div>
        ) : !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-lime-400 px-6 text-[15px] font-semibold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.99] sm:w-auto"
          >
            Claim this listing
          </button>
        ) : (
          <form
            noValidate
            className="relative mt-5 grid gap-3.5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(() => formAction(fd));
            }}
          >
            <input type="hidden" name="listedAcademyId" value={listedAcademyId} />
            <Honeypot id="claim-hp" />

            <Field label="Your name" htmlFor="claim-name" error={err.name}>
              <input
                id="claim-name"
                name="name"
                autoComplete="name"
                required
                maxLength={80}
                aria-invalid={err.name ? true : undefined}
                className={inputClass}
              />
            </Field>
            <Field label="Mobile (we'll call to verify)" htmlFor="claim-phone" error={err.phone}>
              <PhoneInput id="claim-phone" name="phone" error={err.phone} />
            </Field>
            <Field label="Email" htmlFor="claim-email" error={err.email} optional>
              <input
                id="claim-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={120}
                aria-invalid={err.email ? true : undefined}
                className={inputClass}
              />
            </Field>
            <Field label="Your role" htmlFor="claim-role">
              <select id="claim-role" name="role" defaultValue="OWNER" className={`${inputClass} appearance-none`}>
                <option value="OWNER">Owner / Founder</option>
                <option value="MANAGER">Manager</option>
                <option value="COACH">Head coach</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 text-[15px] font-semibold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending ? "Submitting…" : "Submit claim"}
              </button>
              <p className="mt-2 text-[11px] text-zinc-500">
                We verify ownership with a quick call before handing over the listing.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
