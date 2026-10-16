"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, MessageCircle, Plus, Receipt, Trash2, Undo2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addExpense, deleteExpense, getPayroll, markPayoutPaid, markPayoutUnpaid, savePayoutAdjustments } from "@/app/actions/payroll";
import { track } from "@/lib/analytics";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_LABELS,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  formatINR,
  isExpenseCategory,
  isPaymentMode,
  monthLabel,
  netPay,
  payslipText,
  shiftMonth,
} from "@/lib/payroll";

type PayrollResult = Awaited<ReturnType<typeof getPayroll>>;
type Payroll = Extract<PayrollResult, { ok: true }>;
type Row = Payroll["rows"][number];
type ExpenseRow = Payroll["expenses"][number];

const fieldCls = "w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lime-400/60";
const labelCls = "text-xs font-semibold text-zinc-400 uppercase tracking-wide";

const formatDay = (iso: string, utc = false) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: utc ? "UTC" : "Asia/Kolkata" }).format(new Date(iso));

function whatsappLink(phone: string | null, text: string) {
  const digits = (phone || "").replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

function attendanceLine(r: Row) {
  const a = r.attendance;
  if (!a) return null;
  const parts = [`${a.present} in`];
  if (a.halfDay) parts.push(`${a.halfDay} half`);
  if (a.leave) parts.push(`${a.leave} leave`);
  if (a.absent) parts.push(`${a.absent} absent`);
  return parts.join(" · ");
}

export function PayrollPanel({ onOpenTeam }: { onOpenTeam?: () => void }) {
  const [month, setMonth] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Payroll | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [paying, setPaying] = React.useState<Row | null>(null);
  const [addingExpense, setAddingExpense] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async (m?: string | null) => {
    setLoading(true);
    const res = await getPayroll(m ?? undefined);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setError(null);
    setData(res);
    setMonth(res.month);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">{error}</div>;
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading payroll…
      </div>
    );
  }

  const s = data.summary;
  const isFuture = data.month > data.currentMonth;
  const paidCount = data.rows.filter((r) => r.status === "PAID").length;

  const payslip = (r: Row) =>
    payslipText({
      academy: data.academy,
      name: r.name,
      role: r.roleLabel,
      month: data.month,
      payType: r.payType,
      rate: r.rate,
      units: r.units,
      base: r.baseAmount,
      bonus: r.bonus,
      deduction: r.deduction,
      advance: r.advance,
      net: r.netAmount,
      attendance: r.attendance,
      paid: r.status === "PAID" && r.paidAt ? { at: r.paidAt, mode: r.paymentMode, reference: r.reference } : null,
    });

  async function undoPaid(r: Row) {
    setBusy(r.membershipId);
    const res = await markPayoutUnpaid(r.membershipId, data!.month);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${r.name}'s payment is marked unpaid again`);
    load(data!.month);
  }

  async function removeExpense(e: ExpenseRow) {
    if (!window.confirm(`Delete this ${formatINR(e.amount)} expense?`)) return;
    setBusy(e.id);
    const res = await deleteExpense(e.id);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success("Expense deleted");
    load(data!.month);
  }

  return (
    <div className="space-y-6">
      {/* Header + month picker */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-white tracking-tight">Payroll and expenses</h2>
          <p className="text-sm text-zinc-400 mt-0.5">What came in, what went out, and who still needs to be paid.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
          <button type="button" aria-label="Previous month" onClick={() => load(shiftMonth(month!, -1))} className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-800">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[9.5rem] text-center text-sm font-semibold text-white inline-flex items-center justify-center gap-2" aria-live="polite">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
            {monthLabel(data.month)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            disabled={data.month >= data.currentMonth}
            onClick={() => load(shiftMonth(month!, 1))}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Money summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Tile label="Fees collected" value={formatINR(s.feesCollected)} sub={s.feesPendingCount ? `${formatINR(s.feesPending)} still due` : `${s.feesCollectedCount} payments`} tone="in" />
        <Tile label="Salaries" value={formatINR(s.salaries)} sub={s.salariesDue ? `${formatINR(s.salariesDue)} not paid yet` : data.rows.length ? "All paid" : "No pay set"} tone="out" />
        <Tile label="Expenses" value={formatINR(s.expenses)} sub={`${data.expenses.length} entr${data.expenses.length === 1 ? "y" : "ies"}`} tone="out" />
        <Tile label={s.profit >= 0 ? "Profit" : "Loss"} value={formatINR(Math.abs(s.profit))} sub="Fees − salaries − expenses" tone={s.profit >= 0 ? "profit" : "loss"} />
      </div>

      {/* Salaries */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-bold text-white inline-flex items-center gap-2">
            <Wallet className="w-4 h-4 text-lime-300" /> Salaries
          </h3>
          {data.rows.length > 0 && <span className="text-xs text-zinc-500">{paidCount} of {data.rows.length} paid</span>}
        </div>

        {data.rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
            <p className="font-semibold text-zinc-200">No one has pay set yet</p>
            <p className="text-sm text-zinc-500 mt-1">Set a monthly salary or a per-session rate for each coach and staff member on the Team screen.</p>
            {onOpenTeam && (
              <Button onClick={onOpenTeam} variant="outline" className="mt-4 border-zinc-700 text-zinc-200">Go to Team</Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {data.rows.map((r) => {
              const paid = r.status === "PAID";
              const att = attendanceLine(r);
              return (
                <li key={r.membershipId} className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3 sm:p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-heading font-bold text-zinc-200 shrink-0">
                      {r.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white truncate">{r.name}</span>
                        <span className="text-xs text-zinc-400">{r.roleLabel}</span>
                        {r.removed && <span className="text-[11px] text-zinc-500">(left the team)</span>}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {r.payType === "PER_SESSION"
                          ? `${r.units} session${r.units === 1 ? "" : "s"} × ${formatINR(r.rate)}`
                          : `Monthly ${formatINR(r.rate)}`}
                        {att ? ` · ${att}` : ""}
                        {r.bonus ? ` · +${formatINR(r.bonus)} bonus` : ""}
                        {r.deduction ? ` · −${formatINR(r.deduction)} deduction` : ""}
                        {r.advance ? ` · −${formatINR(r.advance)} advance` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-heading text-lg font-bold text-white tabular-nums">{formatINR(r.netAmount)}</div>
                      {paid ? (
                        <span className="text-[11px] font-semibold text-emerald-300">
                          Paid {r.paidAt ? formatDay(r.paidAt) : ""}{r.paymentMode && isPaymentMode(r.paymentMode) ? ` · ${PAYMENT_MODE_LABELS[r.paymentMode]}` : ""}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-300">{isFuture ? "Upcoming" : "Due"}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {data.canManage && !paid && (
                      <Button size="sm" onClick={() => setPaying(r)} disabled={isFuture} className="bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold h-9">
                        Pay {r.name.split(" ")[0]}
                      </Button>
                    )}
                    {r.phone && (
                      <a
                        href={whatsappLink(r.phone, payslip(r))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-3 rounded-lg border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-600 inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Send payslip
                      </a>
                    )}
                    {data.canManage && paid && (
                      <button
                        type="button"
                        disabled={busy === r.membershipId}
                        onClick={() => undoPaid(r)}
                        className="h-9 px-3 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-200 inline-flex items-center gap-1.5"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Mark unpaid
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {data.noPay.length > 0 && (
          <p className="text-xs text-zinc-500">
            No pay set for {data.noPay.map((n) => n.name).join(", ")}.{" "}
            {onOpenTeam && (
              <button type="button" onClick={onOpenTeam} className="text-lime-300 hover:underline">Set pay on Team →</button>
            )}
          </p>
        )}
      </section>

      {/* Expenses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-bold text-white inline-flex items-center gap-2">
            <Receipt className="w-4 h-4 text-lime-300" /> Expenses
          </h3>
          {data.canManage && !isFuture && (
            <Button size="sm" variant="outline" onClick={() => setAddingExpense(true)} className="border-zinc-700 text-zinc-200 h-9">
              <Plus className="w-4 h-4 mr-1" /> Add expense
            </Button>
          )}
        </div>
        {data.expenses.length === 0 ? (
          <p className="text-sm text-zinc-500 rounded-xl border border-dashed border-zinc-800 p-4">
            No expenses in {monthLabel(data.month)}. Add ground rent, shuttles and kit, electricity or tournament fees to see your real profit.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800/70 rounded-xl border border-zinc-800/70 bg-zinc-900/40">
            {data.expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 sm:px-4 py-3">
                <span className="text-xs text-zinc-500 w-12 shrink-0">{formatDay(e.date, true)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white">{isExpenseCategory(e.category) ? EXPENSE_LABELS[e.category] : e.category}</div>
                  {(e.note || e.paymentMode) && (
                    <div className="text-xs text-zinc-500 truncate">
                      {[e.note, e.paymentMode && isPaymentMode(e.paymentMode) ? PAYMENT_MODE_LABELS[e.paymentMode] : null].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <span className="font-semibold text-white tabular-nums">{formatINR(e.amount)}</span>
                {data.canManage && (
                  <button
                    type="button"
                    aria-label="Delete expense"
                    disabled={busy === e.id}
                    onClick={() => removeExpense(e)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-rose-300 hover:bg-zinc-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PayDialog
        row={paying}
        month={data.month}
        onClose={() => setPaying(null)}
        onDone={() => {
          setPaying(null);
          load(data.month);
        }}
      />
      <ExpenseDialog
        open={addingExpense}
        month={data.month}
        currentMonth={data.currentMonth}
        onOpenChange={setAddingExpense}
        onDone={() => {
          setAddingExpense(false);
          load(data.month);
        }}
      />
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "in" | "out" | "profit" | "loss" }) {
  const color = tone === "in" ? "text-white" : tone === "out" ? "text-zinc-200" : tone === "profit" ? "text-lime-300" : "text-rose-300";
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${tone === "profit" ? "border-lime-400/30 bg-lime-400/5" : tone === "loss" ? "border-rose-500/30 bg-rose-500/5" : "border-zinc-800/70 bg-zinc-900/40"}`}>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 font-heading text-xl sm:text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function PayDialog({ row, month, onClose, onDone }: { row: Row | null; month: string; onClose: () => void; onDone: () => void }) {
  const [bonus, setBonus] = React.useState("");
  const [deduction, setDeduction] = React.useState("");
  const [advance, setAdvance] = React.useState("");
  const [note, setNote] = React.useState("");
  const [mode, setMode] = React.useState<string>("UPI");
  const [reference, setReference] = React.useState("");
  const [saving, setSaving] = React.useState<"save" | "pay" | null>(null);

  React.useEffect(() => {
    if (!row) return;
    setBonus(row.bonus ? String(row.bonus) : "");
    setDeduction(row.deduction ? String(row.deduction) : "");
    setAdvance(row.advance ? String(row.advance) : "");
    setNote(row.note ?? "");
    setReference("");
    setMode("UPI");
  }, [row]);

  if (!row) return null;
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const net = netPay(row.baseAmount, num(bonus), num(deduction), num(advance));
  const absentDays = row.attendance ? row.attendance.absent + row.attendance.halfDay * 0.5 : 0;

  async function submit(kind: "save" | "pay") {
    setSaving(kind);
    const adj = { bonus: num(bonus), deduction: num(deduction), advance: num(advance), note };
    const res =
      kind === "pay"
        ? await markPayoutPaid(row!.membershipId, month, { ...adj, paymentMode: mode, reference })
        : await savePayoutAdjustments(row!.membershipId, month, adj);
    setSaving(null);
    if (!res.ok) return toast.error(res.error);
    if (kind === "pay") track("payout_marked_paid", { payment_mode: mode, pay_type: String(row!.payType ?? "unknown") });
    toast.success(kind === "pay" ? `${formatINR(res.netAmount)} paid to ${row!.name}` : "Saved");
    onDone();
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay {row.name}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {monthLabel(month)} ·{" "}
            {row.payType === "PER_SESSION" ? `${row.units} sessions × ${formatINR(row.rate)} = ${formatINR(row.baseAmount)}` : `Monthly salary ${formatINR(row.baseAmount)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1.5">
              <span className={labelCls}>Bonus</span>
              <input id="pay-bonus" inputMode="numeric" className={fieldCls} value={bonus} onChange={(e) => setBonus(e.target.value.replace(/\D/g, ""))} placeholder="0" />
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Deduction</span>
              <input id="pay-deduction" inputMode="numeric" className={fieldCls} value={deduction} onChange={(e) => setDeduction(e.target.value.replace(/\D/g, ""))} placeholder="0" />
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Advance</span>
              <input id="pay-advance" inputMode="numeric" className={fieldCls} value={advance} onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ""))} placeholder="0" />
            </label>
          </div>

          {row.suggestedDeduction > 0 && num(deduction) !== row.suggestedDeduction && (
            <button
              type="button"
              onClick={() => setDeduction(String(row.suggestedDeduction))}
              className="w-full text-left rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/10"
            >
              {absentDays} absent day{absentDays === 1 ? "" : "s"} this month. Tap to deduct {formatINR(row.suggestedDeduction)}.
            </button>
          )}

          <label className="block space-y-1.5">
            <span className={labelCls}>Note (optional)</span>
            <input className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Diwali bonus" maxLength={200} />
          </label>

          <div className="space-y-1.5">
            <span className={labelCls}>Paid by</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment mode">
              {PAYMENT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`h-10 rounded-lg border text-sm font-semibold ${mode === m ? "border-lime-400 bg-lime-400/10 text-lime-200" : "border-zinc-800 text-zinc-400 hover:text-white"}`}
                >
                  {PAYMENT_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          {mode !== "CASH" && (
            <label className="block space-y-1.5">
              <span className={labelCls}>{mode === "UPI" ? "UPI transaction ID" : "Bank reference"} (optional)</span>
              <input className={fieldCls} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
            </label>
          )}

          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <span className="text-sm text-zinc-400">Net pay</span>
            <span className="font-heading text-2xl font-bold text-white tabular-nums">{formatINR(net)}</span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => submit("save")} disabled={!!saving} className="flex-1 border-zinc-700 text-zinc-200 h-11">
              {saving === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save for later"}
            </Button>
            <Button onClick={() => submit("pay")} disabled={!!saving} className="flex-1 bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold h-11">
              {saving === "pay" ? <Loader2 className="w-4 h-4 animate-spin" /> : `Mark ${formatINR(net)} paid`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({
  open,
  month,
  currentMonth,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  month: string;
  currentMonth: string;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const defaultDate = month === currentMonth ? todayStr : `${month}-01`;
  const [date, setDate] = React.useState(defaultDate);
  const [category, setCategory] = React.useState<string>("RENT");
  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState<string>("UPI");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDate(defaultDate);
      setAmount("");
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, month]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await addExpense({ date, category, amount, note, paymentMode: mode });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    track("expense_added", { category, payment_mode: mode });
    toast.success("Expense added");
    onDone();
  }

  const lastDay = `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription className="text-zinc-400">Money the academy spent, so your profit is real.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className={labelCls}>Amount (₹)</span>
              <input id="exp-amount" required inputMode="numeric" className={fieldCls} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" />
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Date</span>
              <input
                id="exp-date"
                type="date"
                className={fieldCls}
                value={date}
                min={`${month}-01`}
                max={month === currentMonth ? todayStr : lastDay}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className={labelCls}>Category</span>
            <select id="exp-category" className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Paid by</span>
            <select className={fieldCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Note (optional)</span>
            <input id="exp-note" className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 dozen shuttles" maxLength={200} />
          </label>
          <Button type="submit" disabled={saving || !amount} className="w-full bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold h-11">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add expense"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
