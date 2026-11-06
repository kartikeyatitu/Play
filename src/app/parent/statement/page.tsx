import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/i18n';
import { localDateString } from '@/lib/fee-aging';
import { buildFeeStatement, normaliseStatementRange, type StatementLine } from '@/lib/fee-statement';
import { PrintButton } from '@/components/org/PrintButton';

export const metadata: Metadata = { title: 'Fee statement · Triq', robots: { index: false, follow: false } };

function monthLabel(m: string) {
  const [y, mo] = (m || '').split('-').map(Number);
  if (!y || !mo) return m;
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function dateLabel(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
const METHOD: Record<string, string> = {
  OFFLINE_RECORDED: 'Recorded by academy',
  PARENT_REPORTED_UPI: 'UPI',
  ADMIN_CONFIRMED_UPI: 'UPI (confirmed)',
  ONLINE_VERIFIED: 'Online',
};

function describe(l: StatementLine): string {
  if (l.kind === 'DUE') return `Fee for ${monthLabel(l.month)}${l.status === 'PENDING_VERIFICATION' ? ' · awaiting confirmation' : l.status === 'PAID' ? '' : ' · unpaid'}`;
  if (l.kind === 'PAYMENT') return `Payment for ${monthLabel(l.month)}${l.method && METHOD[l.method] ? ` · ${METHOD[l.method]}` : ''}`;
  return `Receipt for ${monthLabel(l.month)} · ${l.mode}`;
}

/**
 * Printable fee statement for one of the parent's own children: dues, payments and receipts in a
 * date range, with opening and closing balances. Parents only ever see children whose parentId is
 * their own user id.
 */
export default async function FeeStatementPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireAuth(['PARENT']);
  const orgId: string = session.orgId || '__no_org__';
  const sp = await props.searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const [kids, org] = await Promise.all([
    db.student.findMany({ where: { parentId: session.id, orgId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { name: true, address: true, phone: true, timezone: true, currency: true, locale: true, country: true, phoneCountry: true },
    }),
  ]);
  const tz = org?.timezone || 'Asia/Kolkata';
  const today = localDateString(new Date(), tz);
  const { from, to } = normaliseStatementRange(pick('from'), pick('to'), today);
  const child = kids.find((k) => k.id === pick('child')) ?? kids[0] ?? null;
  const money = (n: number) => formatMoney(n, org);

  let statement = null;
  if (child) {
    const [records, receipts] = await Promise.all([
      db.feeRecord.findMany({
        where: { studentId: child.id, student: { parentId: session.id } },
        select: { id: true, month: true, amount: true, status: true, paymentMethod: true, paidAt: true },
      }),
      db.receipt.findMany({
        where: { studentId: child.id, orgId, student: { parentId: session.id } },
        select: { receiptNumber: true, token: true, feeRecordId: true, month: true, amount: true, paymentMode: true, issuedAt: true },
      }),
    ]);
    statement = buildFeeStatement({
      from,
      to,
      records: records.map((r) => ({ ...r, paidOn: r.paidAt ? localDateString(r.paidAt, tz) : null })),
      receipts: receipts.map((r) => ({ ...r, issuedOn: localDateString(r.issuedAt, tz) })),
    });
  }

  const field = 'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink';

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink print:bg-white print:px-0 print:py-0 print:text-black">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link href="/parent" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Parent home
          </Link>
          {statement && <PrintButton />}
        </div>

        <header>
          <h1 className="text-xl font-semibold">Fee statement</h1>
          <p className="text-sm text-ink-muted print:text-black">
            {org?.name || 'Academy'}
            {org?.address ? ` · ${org.address}` : ''}
            {org?.phone ? ` · ${org.phone}` : ''}
          </p>
          {child && (
            <p className="mt-1 text-sm">
              <span className="font-medium">{child.name}</span> · {dateLabel(from)} to {dateLabel(to)}
            </p>
          )}
        </header>

        <form method="get" className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-3 sm:grid-cols-4 print:hidden">
          {kids.length > 1 && (
            <label className="col-span-2 space-y-1 text-xs text-ink-muted sm:col-span-4">
              Child
              <select name="child" defaultValue={child?.id} className={field}>
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kids.length === 1 && <input type="hidden" name="child" value={kids[0].id} />}
          <label className="space-y-1 text-xs text-ink-muted">
            From
            <input type="date" name="from" defaultValue={from} max={today} className={field} />
          </label>
          <label className="space-y-1 text-xs text-ink-muted">
            To
            <input type="date" name="to" defaultValue={to} max={today} className={field} />
          </label>
          <div className="col-span-2 flex items-end">
            <button type="submit" className="h-10 w-full rounded-md bg-volt text-sm font-medium text-volt-fg">
              Show statement
            </button>
          </div>
        </form>

        {!child && <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">No children are linked to your account.</p>}

        {statement && (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Opening balance', value: statement.openingBalance },
                { label: 'Billed', value: statement.billed },
                { label: 'Paid', value: statement.paid },
                { label: 'Balance due', value: statement.closingBalance },
              ].map((x) => (
                <div key={x.label} className="rounded-xl border border-line bg-surface p-3 print:border-black/20 print:bg-white">
                  <dt className="text-xs text-ink-subtle print:text-black">{x.label}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{money(x.value)}</dd>
                </div>
              ))}
            </dl>

            <section className="rounded-xl border border-line bg-surface print:border-black/20 print:bg-white">
              {statement.lines.length === 0 ? (
                <p className="p-4 text-sm text-ink-muted">Nothing billed or paid in this period.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {statement.lines.map((l, i) => (
                    <li key={`${l.kind}-${l.date}-${i}`} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="text-xs text-ink-subtle print:text-black">{dateLabel(l.date)}</div>
                        <div>{describe(l)}</div>
                        {l.kind !== 'DUE' && 'receipt' in l && l.receipt && (
                          <a href={`/r/${l.receipt.token}`} className="text-xs text-ink-muted underline print:no-underline">
                            Receipt {l.receipt.number}
                          </a>
                        )}
                      </div>
                      <div className={`shrink-0 tabular-nums ${l.kind === 'DUE' ? '' : 'text-success print:text-black'}`}>
                        {l.kind === 'DUE' ? money(l.amount) : `− ${money(l.amount)}`}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className="text-xs text-ink-subtle print:text-black">
              Generated {dateLabel(today)}. Dues fall on the 1st of their month. Fees you marked as paid stay in the balance until the academy confirms them.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
