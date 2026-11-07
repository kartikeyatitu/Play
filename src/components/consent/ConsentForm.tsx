"use client";

import { useMemo, useState, useTransition } from "react";
import { requestConsentCode, saveConsentChoices } from "@/app/actions/consent";
import { CONSENT_PURPOSES, CORE_SERVICE_NOTE, PURPOSE_INFO, type ConsentPurpose } from "@/lib/consent/purposes";

type State = "GRANTED" | "WITHDRAWN" | "NOT_ASKED";

export function ConsentForm({
  studentId,
  childName,
  initial,
}: {
  studentId: string;
  childName: string;
  initial: Record<ConsentPurpose, { state: State; since: string | null }>;
}) {
  const [choice, setChoice] = useState<Record<ConsentPurpose, boolean | null>>(() => {
    const o = {} as Record<ConsentPurpose, boolean | null>;
    for (const p of CONSENT_PURPOSES) o[p] = initial[p].state === "NOT_ASKED" ? null : initial[p].state === "GRANTED";
    return o;
  });
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const changes = useMemo(
    () =>
      CONSENT_PURPOSES.filter((p) => {
        const c = choice[p];
        if (c === null) return false;
        const was = initial[p].state;
        return was === "NOT_ASKED" || (was === "GRANTED") !== c;
      }).map((p) => ({ purpose: p, granted: choice[p] as boolean })),
    [choice, initial],
  );

  const sendCode = () =>
    start(async () => {
      setMsg(null);
      const r = await requestConsentCode();
      if (r.ok) {
        setCodeSent(true);
        setMsg({ tone: "ok", text: "We sent a code to your registered phone." });
      } else setMsg({ tone: "err", text: r.error });
    });

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await saveConsentChoices({ studentId, changes, otp });
      if (r.ok) {
        setOtp("");
        setCodeSent(false);
        setMsg({ tone: "ok", text: r.recorded ? "Saved. Your choices are recorded." : "No changes to record." });
      } else setMsg({ tone: "err", text: r.error });
    });

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {CONSENT_PURPOSES.map((p) => {
          const info = PURPOSE_INFO[p];
          const c = choice[p];
          const offWarn = p === "CORE_SERVICE" && c === false && initial[p].state !== "WITHDRAWN";
          return (
            <li key={p} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{info.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{info.notice}</p>
                </div>
                <div role="radiogroup" aria-label={`${info.label} for ${childName}`} className="flex shrink-0 overflow-hidden rounded-lg border border-white/10">
                  {[
                    { v: true, label: "Yes" },
                    { v: false, label: "No" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="radio"
                      aria-checked={c === o.v}
                      onClick={() => setChoice((s) => ({ ...s, [p]: o.v }))}
                      className={`min-h-11 min-w-12 px-3 text-sm font-medium ${
                        c === o.v ? (o.v ? "bg-lime-400 text-zinc-950" : "bg-rose-500/80 text-white") : "text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {offWarn ? <p className="mt-2 text-xs text-amber-300">{CORE_SERVICE_NOTE}</p> : null}
              {c === null ? <p className="mt-2 text-xs text-zinc-500">Not answered yet.</p> : null}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 -mx-4 border-t border-white/10 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        {msg ? (
          <p role={msg.tone === "err" ? "alert" : "status"} className={`mb-2 text-sm ${msg.tone === "err" ? "text-rose-300" : "text-emerald-300"}`}>
            {msg.text}
          </p>
        ) : null}
        {changes.length === 0 ? (
          <p className="text-sm text-zinc-400">Change an answer above to save it.</p>
        ) : !codeSent ? (
          <button type="button" disabled={pending} onClick={sendCode} className="min-h-12 w-full rounded-lg bg-lime-400 text-sm font-semibold text-zinc-950 disabled:opacity-60">
            {pending ? "Sending…" : `Confirm ${changes.length} change${changes.length > 1 ? "s" : ""} with a code`}
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              aria-label="Code from SMS or WhatsApp"
              className="min-h-12 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 text-base tracking-widest text-zinc-100"
            />
            <button type="button" disabled={pending || otp.length < 4} onClick={save} className="min-h-12 shrink-0 rounded-lg bg-lime-400 px-4 text-sm font-semibold text-zinc-950 disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
