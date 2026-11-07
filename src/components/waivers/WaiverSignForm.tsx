"use client";

import { useState, useTransition } from "react";
import { signWaiver } from "@/app/actions/waivers";

export function WaiverSignForm({ templateId, studentId, childName, defaultName }: { templateId: string; studentId: string; childName: string; defaultName?: string }) {
  const [name, setName] = useState(defaultName ?? "");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
        Signed for {childName}. Thank you.
      </p>
    );
  }

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await signWaiver({ templateId, studentId, signedName: name, agreed });
      if (r.ok) setDone(true);
      else setError(r.error);
    });

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-400">Type your full name to sign</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="min-h-12 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 text-base text-zinc-100"
        />
      </label>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-zinc-300">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-lime-400" />
        <span>
          I am {childName}&apos;s parent or legal guardian, I have read this waiver and I agree to it on their behalf.
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      <button type="button" disabled={pending || !agreed || name.trim().length < 3} onClick={submit} className="min-h-12 w-full rounded-lg bg-lime-400 text-sm font-semibold text-zinc-950 disabled:opacity-50">
        {pending ? "Signing…" : "Sign waiver"}
      </button>
    </div>
  );
}
