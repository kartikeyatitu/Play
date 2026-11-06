"use client";

import { CalendarDays, CheckCircle2, FileText, Trophy, MessageSquareQuote, Receipt } from "lucide-react";
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
    <section aria-label={`${data.name} summary`} className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <h2 className="truncate text-lg font-semibold text-ink">{data.name}</h2>
        {data.batchName && <span className="truncate text-xs text-ink-subtle">{data.batchName}</span>}
      </header>

      <dl className="grid grid-cols-2 gap-px bg-line mt-3 border-y border-line">
        <div className="bg-surface p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-subtle">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Next session
          </dt>
          <dd className="mt-1 text-sm font-medium text-ink">
            {data.nextSession ? (
              <>
                {dayLabel(data.nextSession.date, today)}
                {data.nextSession.time ? `, ${data.nextSession.time}` : ""}
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
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-subtle">
          <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden /> Coach&apos;s latest note
        </div>
        {data.note ? (
          <p className="mt-1 text-sm text-ink">
            {data.note.note ?? <span className="text-ink-muted">Progress report for {monthLabel(data.note.month)} is in.</span>}
            <span className="mt-0.5 block text-xs text-ink-subtle">
              {monthLabel(data.note.month)} · average {data.note.average}/5
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">No progress report yet.</p>
        )}
      </div>

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
