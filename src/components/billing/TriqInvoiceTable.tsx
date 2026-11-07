import type { TriqInvoiceView } from "@/app/actions/triq-billing";
import { formatMinor } from "@/lib/billing/calc";
import { Pill, istDate } from "@/components/verticals/ui";

const TONE: Record<string, "amber" | "sky" | "emerald" | "rose" | "zinc"> = { DRAFT: "amber", ISSUED: "sky", PAID: "emerald", VOID: "rose" };

/** TRIQ's own invoices to the academy, with the GST breakup (CGST + SGST, or IGST). */
export function TriqInvoiceTable({ invoices }: { invoices: TriqInvoiceView[] }) {
  if (!invoices.length) return <p className="text-sm text-zinc-400">No invoices yet. Academies with 30 or fewer active students are on the Free plan.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-400">
            <th className="py-2 pr-3 font-medium">Invoice</th>
            <th className="py-2 pr-3 font-medium">Period</th>
            <th className="py-2 pr-3 text-right font-medium">Students</th>
            <th className="py-2 pr-3 text-right font-medium">Taxable</th>
            <th className="py-2 pr-3 text-right font-medium">Tax</th>
            <th className="py-2 pr-3 text-right font-medium">Total</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {invoices.map((i) => (
            <tr key={i.id} className="align-top">
              <td className="py-3 pr-3 font-mono text-xs text-zinc-200">{i.invoiceNumber}</td>
              <td className="py-3 pr-3 text-zinc-300">
                {istDate(i.periodStart)} – {istDate(i.periodEnd)}
              </td>
              <td className="py-3 pr-3 text-right tabular-nums">{i.activeStudents}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{formatMinor(i.amountPaise, i.currency)}</td>
              <td className="py-3 pr-3 text-right tabular-nums text-xs text-zinc-300">
                {i.taxKind === "CGST_SGST" && (
                  <>
                    <div>CGST 9%: {formatMinor(i.cgstPaise, i.currency)}</div>
                    <div>SGST 9%: {formatMinor(i.sgstPaise, i.currency)}</div>
                  </>
                )}
                {i.taxKind === "IGST" && <div>IGST 18%: {formatMinor(i.igstPaise, i.currency)}</div>}
                {i.taxKind === "NONE" && <div className="text-zinc-500">—</div>}
              </td>
              <td className="py-3 pr-3 text-right font-semibold tabular-nums">{formatMinor(i.totalPaise, i.currency)}</td>
              <td className="py-3">
                <Pill tone={TONE[i.status] ?? "zinc"}>{i.status === "DRAFT" ? "Draft" : i.status.charAt(0) + i.status.slice(1).toLowerCase()}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
