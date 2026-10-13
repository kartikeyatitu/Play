// Small shared form primitives for directory forms (client-safe, no hooks).

export const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 text-base text-white placeholder:text-zinc-600 outline-none transition focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 aria-[invalid=true]:border-rose-500/60 sm:text-sm";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-zinc-300">
        <span>{label}</span>
        {optional && <span className="text-[11px] font-normal text-zinc-600">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Off-screen honeypot. Real users never see or fill it. */
export function Honeypot({ id }: { id: string }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor={id}>Company website</label>
      <input id={id} name="company_website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

export function PhoneInput({ id, name, error, defaultValue }: { id: string; name: string; error?: string; defaultValue?: string }) {
  return (
    <div className="flex min-w-0">
      <span className="inline-flex h-11 shrink-0 items-center rounded-l-xl border border-r-0 border-white/10 bg-zinc-900 px-3 text-sm text-zinc-400">
        +91
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        required
        maxLength={14}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} rounded-l-none`}
      />
    </div>
  );
}
