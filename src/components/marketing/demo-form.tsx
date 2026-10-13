"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { submitDemoRequest, type DemoFormState } from "@/app/actions/sales-leads";

const SPORTS = [
  "Cricket",
  "Football",
  "Badminton",
  "Tennis",
  "Swimming",
  "Basketball",
  "Table tennis",
  "Skating",
  "Martial arts",
  "Athletics",
  "Multi-sport",
  "Other",
];

const initialState: DemoFormState = { status: "idle" };

const inputClass =
  "block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400/60 focus:outline-none focus:ring-2 focus:ring-lime-400/20 aria-[invalid=true]:border-red-500/70";

function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label} {optional && <span className="font-normal text-zinc-400">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "Book a 15-min demo" form. Saves to SalesLead via a server action.
 * `utm` is a JSON string built on the server from the page's searchParams.
 */
export function DemoForm({
  utm,
  defaultCity = "Gurgaon",
  whatsappHref,
}: {
  utm: string;
  defaultCity?: string;
  whatsappHref?: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitDemoRequest, initialState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col items-center rounded-2xl border border-lime-400/30 bg-lime-400/5 p-8 text-center">
        <CheckCircle2 className="mb-3 h-10 w-10 text-lime-400" aria-hidden />
        <p className="text-lg font-semibold text-zinc-50">Request received</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">{state.message}</p>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25"
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> Can&apos;t wait? Message us now
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="relative space-y-4">
      {/* Honeypot — hidden from humans and assistive tech */}
      <div aria-hidden className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="demo-website">Website</label>
        <input id="demo-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="utm" value={utm} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="demo-name" label="Your name" error={fe.name}>
          <input
            id="demo-name"
            name="name"
            required
            autoComplete="name"
            placeholder="Rahul Sharma"
            defaultValue={v.name}
            className={inputClass}
            aria-invalid={!!fe.name}
            aria-describedby={fe.name ? "demo-name-error" : undefined}
          />
        </Field>
        <Field id="demo-phone" label="WhatsApp number" error={fe.phone}>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-400">
              +91
            </span>
            <input
              id="demo-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              required
              autoComplete="tel-national"
              placeholder="98765 43210"
              defaultValue={v.phone}
              maxLength={16}
              className={inputClass + " rounded-l-none"}
              aria-invalid={!!fe.phone}
              aria-describedby={fe.phone ? "demo-phone-error" : undefined}
            />
          </div>
        </Field>
      </div>

      <Field id="demo-academy" label="Academy name" error={fe.academy} optional>
        <input
          id="demo-academy"
          name="academy"
          autoComplete="organization"
          placeholder="e.g. Sharma Cricket Academy"
          defaultValue={v.academy}
          className={inputClass}
          aria-invalid={!!fe.academy}
          aria-describedby={fe.academy ? "demo-academy-error" : undefined}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="demo-sport" label="Sport" error={fe.sport} optional>
          <select id="demo-sport" name="sport" defaultValue={v.sport ?? ""} className={inputClass} aria-invalid={!!fe.sport}>
            <option value="">Select</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field id="demo-students" label="Students" error={fe.students} optional>
          <input
            id="demo-students"
            name="students"
            type="number"
            inputMode="numeric"
            min={1}
            max={20000}
            placeholder="60"
            defaultValue={v.students}
            className={inputClass}
            aria-invalid={!!fe.students}
            aria-describedby={fe.students ? "demo-students-error" : undefined}
          />
        </Field>
        <Field id="demo-city" label="City" error={fe.city}>
          <input
            id="demo-city"
            name="city"
            defaultValue={v.city ?? defaultCity}
            autoComplete="address-level2"
            className={inputClass}
            aria-invalid={!!fe.city}
          />
        </Field>
      </div>

      <div aria-live="polite" className="min-h-[1.25rem] text-sm">
        {state.status === "error" && state.message && <p className="text-red-400">{state.message}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Sending…" : "Book my 15-min demo"}
      </button>
      <p className="text-center text-xs text-zinc-400">
        We&apos;ll only use your number to schedule the demo. No spam, ever.
      </p>
    </form>
  );
}
