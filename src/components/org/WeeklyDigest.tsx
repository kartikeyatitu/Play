"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, MessageCircle } from "lucide-react";
import { getWeeklyDigest } from "@/app/actions/insights";
import type { WeeklyDigest as Digest } from "@/lib/digest-data";

export function WeeklyDigest() {
  const [data, setData] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getWeeklyDigest()
      .then((res) => {
        if (!alive) return;
        if (res.success) setData(res.data);
        else setError(res.error);
      })
      .catch(() => alive && setError("Couldn't build the weekly summary. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  if (loading) return <p className="flex items-center gap-2 text-sm text-ink-subtle"><Loader2 className="w-4 h-4 animate-spin" /> Building this week&apos;s summary…</p>;
  if (error || !data) return <p className="text-sm text-danger">{error ?? "Couldn't build the weekly summary."}</p>;
  return <WeeklyDigestView data={data} />;
}

export function WeeklyDigestView({ data }: { data: Digest }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(data.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section className="rounded-xl border border-line bg-surface p-4 space-y-3" aria-labelledby="weekly-digest-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="weekly-digest-title" className="text-sm font-semibold text-ink">This week · {data.weekLabel}</h3>
        <p className="text-xs text-ink-subtle">Last 7 days compared with the 7 before</p>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {data.lines.map((l) => (
          <div key={l.label} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-2">
            <dt className="text-sm text-ink-muted">{l.label}</dt>
            <dd className="text-sm text-ink tabular-nums text-right">
              {l.value}
              {l.change && <span className="block text-xs text-ink-subtle">{l.change}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-subtle">Do this week</p>
        <ul className="mt-1 space-y-1 text-sm text-ink list-disc pl-5">
          {data.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(data.text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-volt text-volt-fg text-sm font-semibold hover:bg-volt/90"
        >
          <MessageCircle className="w-4 h-4" aria-hidden /> Share on WhatsApp
        </a>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line text-sm text-ink hover:bg-surface-2">
          {copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />} {copied ? "Copied" : "Copy summary"}
        </button>
      </div>
      <p className="text-xs text-ink-subtle">No student names are included. You choose who to send it to.</p>
    </section>
  );
}
