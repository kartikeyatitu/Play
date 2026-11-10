"use client";

import { CalendarDays, CheckCircle2, ChevronRight, FileText, Navigation, Trophy, MessageSquareQuote, Receipt, Sparkles } from "lucide-react";
import { directionsUrl } from "@/components/maps/VenueMap";
import { ReadAloudButton } from "@/components/voice/ReadAloudButton";
import { CheckoutModal } from "@/components/parent/CheckoutModal";
import type { HomeFeeStatus, NextSession } from "@/components/parent/home-summary";
import { useFormatMoney } from "@/lib/org-locale-context";

export interface ChildTopCardData {
  id: string;
  name: string;
  batchName: string | null;
  nextSession: NextSession | null;
  week: { present: number; total: number };
  fee: HomeFeeStatus;
  latestReceiptToken: string | null;
  note: { month: string; note: string | null; average: number } | null;
  sessionNote?: { date: string; text: string } | null;
  cover?: string | null;
  venue?: string | null;
}

/** CSS url() for an academy photo, only for plain https URLs (no quotes or brackets that could break the style). */
function coverUrl(u: string | null | undefined): string | null {
  return u && /^https:\/\/[^\s"'()<>\\]+$/.test(u) ? `url("${u}")` : null;
}

function dayLabel(ymd: string, today: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const t = new Date(`${today}T00:00:00Z`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function monthLabel(m: string) {
  const [y, mo] = (m || "").split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

function dateLabel(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** One card per child at the top of the parent home: next session, this week, fees, latest coach note. */
export function ChildTopCard({
  data,
  today,
  academyName,
  upiId,
  formatMoney,
}: {
  data: ChildTopCardData;
  today: string;
  academyName?: string | null;
  upiId?: string | null;
  formatMoney?: (n: number) => string;
}) {
  const orgMoney = useFormatMoney();
  const fmt = formatMoney ?? orgMoney;
  const { fee } = data;
  const feeTone = fee.state === "OVERDUE" ? "text-danger" : fee.state === "DUE" ? "text-warn" : fee.state === "AWAITING" ? "text-ink-muted" : "text-success";

  return (
    <section aria-label={`${data.name} summary`} className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)]">
      <header
        className="relative flex h-32 items-end overflow-hidden px-4 pb-3"
        style={
          coverUrl(data.cover)
            ? { backgroundImage: coverUrl(data.cover)!, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 55%, #0b241a))" }
        }
      >
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#000000c0] via-[#0000004d] to-transparent" />
        <div className="relative flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fffffff2] text-base font-bold text-[#13261e] shadow-lg">
            {data.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold leading-tight text-[#ffffff]">{data.name}</h2>
            {data.batchName && <p className="truncate text-xs text-[#ffffffcc]">{data.batchName}</p>}
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-line border-b border-line">
        <div className="bg-surface p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-subtle">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Next session
          </dt>
          <dd className="mt-1 text-sm font-medium text-ink">
            {data.nextSession ? (
              <>
                {dayLabel(data.nextSession.date, today)}
                {data.nextSession.time ? `, ${data.nextSession.time}` : ""}
                {data.venue && (
                  <a
                    href={directionsUrl(data.venue)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-xs font-semibold brand-text"
                  >
                    <Navigation className="h-3 w-3" aria-hidden /> Directions
                  </a>
                )}
              </>
            ) : (
              <span className="text-ink-muted">Not scheduled</span>
            )}
          </dd>
        </div>
        <div className="bg-surface p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-subtle">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> This week
          </dt>
          <dd className="mt-1 text-sm font-medium text-ink tabular-nums">
            {data.week.total > 0 ? (
              <>
                {data.week.present}/{data.week.total} <span className="font-normal text-ink-muted">attended</span>
                <span className="mt-1.5 flex gap-1" aria-hidden>
                  {Array.from({ length: Math.min(data.week.total, 7) }, (_, i) => (
                    <span key={i} className={`h-2 w-2 rounded-full ${i < data.week.present ? "brand-bg" : "bg-line"}`} />
                  ))}
                </span>
              </>
            ) : (
              <span className="text-ink-muted">No sessions yet</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-ink-subtle">Fees</div>
          {fee.state === "CLEAR" ? (
            <div className={`text-sm font-medium ${feeTone}`}>All paid · next due {dateLabel(fee.nextDueDate)}</div>
          ) : fee.state === "AWAITING" ? (
            <div className={`text-sm font-medium ${feeTone}`}>{fmt(fee.awaitingAmount)} awaiting academy confirmation</div>
          ) : (
            <div className={`text-sm font-medium ${feeTone}`}>
              {fmt(fee.dueAmount)} {fee.state === "OVERDUE" ? "overdue" : "due"} · since {dateLabel(fee.nextDueDate)}
            </div>
          )}
        </div>
        <div className="shrink-0">
          {fee.payRecord && fee.state !== "CLEAR" ? (
            <CheckoutModal
              feeRecordId={fee.payRecord.id}
              amount={fee.payRecord.amount}
              month={fee.payRecord.month}
              status={fee.payRecord.status}
              studentName={data.name}
              academyName={academyName}
              upiId={upiId}
            />
          ) : data.latestReceiptToken ? (
            <a
              href={`/r/${data.latestReceiptToken}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface-2"
            >
              <Receipt className="h-4 w-4" aria-hidden /> Receipt
            </a>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-subtle">
            <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden /> Coach&apos;s latest note
          </div>
          {data.sessionNote && <ReadAloudButton text={data.sessionNote.text} className="min-h-8 px-2.5 text-xs" />}
        </div>
        {data.sessionNote ? (
          <p className="mt-1 text-sm text-ink">
            {data.sessionNote.text}
            <span className="mt-0.5 block text-xs text-ink-subtle">{dayLabel(data.sessionNote.date, today)}</span>
          </p>
        ) : data.note ? (
          <p className="mt-1 text-sm text-ink">
            {data.note.note ?? <span className="text-ink-muted">Progress report for {monthLabel(data.note.month)} is in.</span>}
            <span className="mt-0.5 block text-xs text-ink-subtle">
              {monthLabel(data.note.month)} · average {data.note.average}/5
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">No notes from the coach yet.</p>
        )}
      </div>

      <a
        href={`/story/${encodeURIComponent(data.id)}`}
        className="flex min-h-12 items-center justify-between gap-2 border-t border-line px-4 text-sm font-semibold text-ink hover:bg-surface-2"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 brand-text" aria-hidden /> {data.name.split(" ")[0]}&apos;s week
        </span>
        <ChevronRight className="h-4 w-4 text-ink-subtle" aria-hidden />
      </a>

      <div className="grid grid-cols-2 border-t border-line">
        <a
          href={`/athlete/${encodeURIComponent(data.id)}`}
          className="flex min-h-11 items-center justify-center gap-1.5 border-r border-line text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <Trophy className="h-4 w-4" aria-hidden /> Athlete passport
        </a>
        <a
          href={`/parent/statement?child=${encodeURIComponent(data.id)}`}
          className="flex min-h-11 items-center justify-center gap-1.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <FileText className="h-4 w-4" aria-hidden /> Fee statement
        </a>
      </div>
    </section>
  );
}
