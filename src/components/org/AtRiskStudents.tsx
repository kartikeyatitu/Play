"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Loader2, MessageCircle } from "lucide-react";
import { getAtRiskStudents } from "@/app/actions/insights";
import type { AtRiskStudent, AtRiskSummary } from "@/lib/risk-data";

const LEVEL_LABEL: Record<AtRiskStudent["level"], string> = { high: "High", medium: "Medium", low: "Low" };
const LEVEL_CLASS: Record<AtRiskStudent["level"], string> = {
  high: "border-danger/40 bg-danger/10 text-danger",
  medium: "border-warn/40 bg-warn/10 text-warn",
  low: "border-line bg-surface-2 text-ink-muted",
};

export function AtRiskStudents() {
  const [data, setData] = useState<AtRiskSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLow, setShowLow] = useState(false);

  useEffect(() => {
    let alive = true;
    getAtRiskStudents()
      .then((res) => {
        if (!alive) return;
        if (res.success) setData(res.data);
        else setError(res.error);
      })
      .catch(() => alive && setError("Couldn't load at-risk students. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-subtle">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking attendance and fees…
      </p>
    );
  }
  if (error || !data) return <p className="text-sm text-danger">{error ?? "Couldn't load at-risk students."}</p>;
  return <AtRiskStudentsView data={data} showLow={showLow} onToggleLow={() => setShowLow((v) => !v)} />;
}

export function AtRiskStudentsView({ data, showLow, onToggleLow }: { data: AtRiskSummary; showLow: boolean; onToggleLow: () => void }) {
  const visible = data.students.filter((s) => showLow || s.level !== "low");
  return (
    <section className="space-y-3" aria-labelledby="at-risk-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="at-risk-title" className="text-sm font-semibold text-ink">Students who may drop out</h3>
        <p className="text-xs text-ink-subtle">
          {data.high} high · {data.medium} medium · {data.low} low, of {data.checked} enrolled
        </p>
      </div>
      <p className="text-xs text-ink-subtle">
        Based on each student&apos;s last 16 sessions, unpaid fees and how recently they joined. A guide for who to call first, not a prediction.
      </p>

      {data.checked === 0 ? (
        <p className="text-sm text-ink-muted">No students are enrolled in a batch yet.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {data.low > 0 ? "No one is at high or medium risk right now." : "No students look at risk right now."}
          {data.low > 0 && (
            <button type="button" onClick={onToggleLow} className="ml-2 underline underline-offset-2 hover:text-ink">
              Show {data.low} low
            </button>
          )}
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {visible.map((s) => (
              <AtRiskRow key={s.studentId} s={s} />
            ))}
          </ul>
          {data.low > 0 && (
            <button type="button" onClick={onToggleLow} className="text-xs font-medium text-ink-muted underline underline-offset-2 hover:text-ink">
              {showLow ? "Hide low risk" : `Show ${data.low} low risk`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function AtRiskRow({ s }: { s: AtRiskStudent }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-line bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/student/${s.studentId}`} className="font-semibold text-ink hover:underline">
            {s.name}
          </Link>
          <p className="text-xs text-ink-subtle">
            {s.batches.join(", ") || "No batch"}
            {s.lastPresent ? ` · last attended ${shortDate(s.lastPresent)}` : " · no attendance recorded"}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${LEVEL_CLASS[s.level]}`}>
          {s.level !== "low" && <AlertTriangle className="w-3 h-3" aria-hidden />}
          {LEVEL_LABEL[s.level]} risk
        </span>
      </div>
      <ul className="space-y-1 text-sm text-ink-muted list-disc pl-5">
        {s.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {s.whatsappUrl ? (
          <a
            href={s.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-volt text-volt-fg text-sm font-semibold hover:bg-volt/90"
          >
            <MessageCircle className="w-4 h-4" aria-hidden /> Message {s.parentName.split(" ")[0] || "parent"} on WhatsApp
          </a>
        ) : (
          <span className="text-xs text-ink-subtle">No parent number, or you don&apos;t have permission to contact parents.</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-line text-sm text-ink hover:bg-surface-2"
        >
          Preview message <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {open && (
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-ink whitespace-pre-line">
          {s.message}
          <span className="block mt-2 text-xs text-ink-subtle">WhatsApp opens with this text. You can edit it before sending.</span>
        </p>
      )}
    </li>
  );
}

/** "2026-10-20" → "20 Oct" (calendar date; no timezone conversion). */
function shortDate(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m >= 1 && m <= 12 ? `${day} ${names[m - 1]}` : d;
}
