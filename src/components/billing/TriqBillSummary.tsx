import { formatMinor, type TriqBill } from "@/lib/billing/calc";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${strong ? "font-semibold text-zinc-100" : "text-zinc-300"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Estimate card: one bill (monthly or annual) with discount and tax lines. */
export function TriqBillSummary({ title, bill, founding }: { title: string; bill: TriqBill; founding: boolean }) {
  const f = (m: number) => formatMinor(m, bill.currency);
  return (
    <div className="rounded-xl border border-white/10 p-4 text-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">{title}</div>
      {!bill.billable ? (
        <p className="text-zinc-300">{bill.activeStudents} active students — Free plan, nothing to pay.</p>
      ) : (
        <>
          <Row label={`${bill.activeStudents} active students`} value={`${f(bill.monthlyMinor)} / month`} />
          {bill.cycle === "ANNUAL" && <Row label={`Annual: pay ${bill.monthsCharged} months, get ${bill.monthsCovered}`} value={f(bill.grossMinor)} />}
          {bill.discountMinor > 0 && <Row label={founding ? "Founding academy offer" : "Discount"} value={`− ${f(bill.discountMinor)}`} />}
          <Row label="Taxable value" value={f(bill.taxableMinor)} />
          {bill.taxKind === "CGST_SGST" && (
            <>
              <Row label="CGST 9%" value={f(bill.cgstMinor)} />
              <Row label="SGST 9%" value={f(bill.sgstMinor)} />
            </>
          )}
          {bill.taxKind === "IGST" && <Row label="IGST 18%" value={f(bill.igstMinor)} />}
          {bill.taxKind === "NONE" && bill.currency === "USD" && <Row label="Indian GST" value="Not applicable" />}
          <div className="mt-1 border-t border-white/10 pt-1">
            <Row label="Total" value={f(bill.totalMinor)} strong />
          </div>
        </>
      )}
    </div>
  );
}
