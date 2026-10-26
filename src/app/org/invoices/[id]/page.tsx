import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { getGstDocument } from "@/app/actions/gst-invoices";
import { GST_STATE_CODES, amountInWords, formatMinorINR, formatRate } from "@/lib/gst";
import { PrintButton } from "@/components/org/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tax invoice | Triq", robots: { index: false, follow: false } };

function stateName(code: string) {
  return `${GST_STATE_CODES[code] ?? "—"} (${code})`;
}

/** Printable GST tax invoice / credit note (flag gstInvoices, fees.collect). */
export default async function GstInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  if (!FEATURES.gstInvoices) notFound();
  const { id } = await params;
  const res = await getGstDocument(id);
  if (!res.success) {
    return <main className="mx-auto max-w-2xl p-6 text-sm text-zinc-700">{res.error}</main>;
  }
  const { doc, original } = res;
  const isCN = doc.kind === "CREDIT_NOTE";
  const intra = doc.igstMinor === 0 && (doc.cgstMinor > 0 || doc.placeOfSupply === doc.supplierStateCode);
  const half = formatRate(doc.rateBps / 2);
  const balanceDue = !isCN ? doc.totalMinor - doc.amountReceivedMinor : 0;

  const rows: [string, number][] = [["Taxable value", doc.taxableMinor]];
  if (intra) {
    rows.push([`CGST @ ${half}`, doc.cgstMinor], [`SGST/UTGST @ ${half}`, doc.sgstMinor]);
  } else {
    rows.push([`IGST @ ${formatRate(doc.rateBps)}`, doc.igstMinor]);
  }
  if (doc.roundOffMinor !== 0) rows.push(["Round off", doc.roundOffMinor]);

  return (
    <main className="min-h-screen bg-white text-zinc-900 print:bg-white">
      <div className="mx-auto max-w-3xl p-4 sm:p-8 space-y-6">
        <div className="flex justify-end">
          <PrintButton />
        </div>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-300 pb-4">
          <div className="min-w-0">
            <p className="text-lg font-bold break-words">{doc.supplierLegalName}</p>
            <p className="text-sm whitespace-pre-line break-words">{doc.supplierAddress}</p>
            <p className="text-sm">GSTIN: <span className="font-mono">{doc.supplierGstin}</span></p>
            <p className="text-sm">State: {stateName(doc.supplierStateCode)}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide">{isCN ? "Credit note" : "Tax invoice"}</p>
            <p className="text-sm">No. <span className="font-mono">{doc.number}</span></p>
            <p className="text-sm">Date: {doc.issueDay}</p>
            {isCN && original && (
              <p className="text-sm">
                Against invoice <span className="font-mono">{original.number}</span> dated {original.issueDay}
              </p>
            )}
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="font-semibold">Billed to</p>
            <p>{doc.recipientName}</p>
            {doc.studentName && doc.studentName !== doc.recipientName && <p>For student: {doc.studentName}</p>}
          </div>
          <div className="sm:text-right">
            <p>Place of supply: {stateName(doc.placeOfSupply)}</p>
            <p>Prices are {doc.priceMode === "EXCLUSIVE" ? "exclusive" : "inclusive"} of GST</p>
            {doc.paidAt && !isCN && <p>Payment received: {doc.paidAt.toISOString().slice(0, 10)}</p>}
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-zinc-300 text-left">
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 px-2">SAC</th>
                <th className="py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-200 align-top">
                <td className="py-2 pr-2">{doc.description}</td>
                <td className="py-2 px-2 font-mono">{doc.sacCode}</td>
                <td className="py-2 pl-2 text-right">{formatMinorINR(doc.taxableMinor)}</td>
              </tr>
              {rows.slice(1).map(([label, v]) => (
                <tr key={label}>
                  <td colSpan={2} className="py-1 pr-2 text-right text-zinc-600">{label}</td>
                  <td className="py-1 pl-2 text-right">{formatMinorINR(v)}</td>
                </tr>
              ))}
              <tr className="border-t border-zinc-300 font-semibold">
                <td colSpan={2} className="py-2 pr-2 text-right">{isCN ? "Total credited" : "Invoice total"}</td>
                <td className="py-2 pl-2 text-right">{formatMinorINR(doc.totalMinor)}</td>
              </tr>
              {!isCN && doc.priceMode === "EXCLUSIVE" && (
                <>
                  <tr>
                    <td colSpan={2} className="py-1 pr-2 text-right text-zinc-600">Amount received</td>
                    <td className="py-1 pl-2 text-right">{formatMinorINR(doc.amountReceivedMinor)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="py-1 pr-2 text-right text-zinc-600">Balance due</td>
                    <td className="py-1 pl-2 text-right">{formatMinorINR(balanceDue)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-sm"><span className="font-semibold">Amount in words:</span> {amountInWords(doc.totalMinor)}</p>
        {isCN && doc.reason && <p className="text-sm"><span className="font-semibold">Reason:</span> {doc.reason}</p>}
        <p className="text-xs text-zinc-500">Tax is not payable on reverse charge basis. This is a computer-generated document.</p>
      </div>
    </main>
  );
}
