import { notFound } from "next/navigation";
import { getReceiptByToken } from "@/lib/receipt-service";
import { CheckCircle2, ShieldCheck, Printer, Share2, ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export async function generateMetadata(props: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await props.params;
  const data = await getReceiptByToken(token);
  if (!data) return { title: "Receipt Not Found · Triq" };

  return {
    title: `Receipt ${data.receipt.receiptNumber} · ${data.receipt.studentName} · ${data.org?.name || "Triq"}`,
    description: `Official payment receipt for ${data.receipt.studentName} (${data.receipt.month}). Verified by Triq Sports OS.`,
  };
}

function formatMonthHuman(monthStr: string): string {
  if (!monthStr || !monthStr.includes("-")) return monthStr;
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return monthStr;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function ReceiptPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const data = await getReceiptByToken(token);

  if (!data) {
    notFound();
  }

  const { receipt, org } = data;
  const formattedMonth = formatMonthHuman(receipt.month);

  // Generate QR code as SVG/data URI for live receipt verification
  const verificationUrl = `https://triqsports.vercel.app/r/${token}`;
  let qrDataUri = "";
  try {
    qrDataUri = await QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 140,
      color: {
        dark: "#09090b",
        light: "#ffffff",
      },
    });
  } catch {
    qrDataUri = "";
  }

  const shareText = `*Fee Payment Receipt*\nStudent: ${receipt.studentName}\nAcademy: ${org?.name || "Academy"}\nMonth: ${formattedMonth}\nAmount: ₹${receipt.amount.toLocaleString("en-IN")}\nReceipt #: ${receipt.receiptNumber}\n\nView & verify official receipt:\n${verificationUrl}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-8 px-4 sm:px-6 flex flex-col items-center justify-start print:bg-white print:text-black print:p-0 print:m-0">
      {/* Top Action Bar (hidden when printing) */}
      <div className="w-full max-w-xl mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/"
          className="inline-flex items-center text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" /> Share WhatsApp
          </a>
          <button
            type="button"
            onClick={undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-all cursor-pointer"
            id="print-btn"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Official Receipt Card */}
      <div className="w-full max-w-xl bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black print:p-4">
        {/* Verification Watermark & Header Badge */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-5 mb-6 print:border-zinc-300">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-lime-400 animate-pulse print:hidden" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-lime-400 print:text-emerald-700">
                Verified Payment
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1 print:text-black">
              {org?.name || "Sports Academy"}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5 print:text-zinc-600">
              {org?.city ? `${org.city}${org.state ? `, ${org.state}` : ""}` : "India"} · {org?.phone || "Sports Academy Management"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono text-zinc-500 print:text-zinc-500">Receipt No.</div>
            <div className="font-mono text-xs sm:text-sm font-bold text-zinc-200 print:text-black">
              {receipt.receiptNumber}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 print:text-zinc-600">
              {new Date(receipt.issuedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* Student & Payment Summary */}
        <div className="grid grid-cols-2 gap-4 py-4 rounded-xl bg-zinc-950/60 border border-zinc-800/60 px-4 mb-6 print:bg-zinc-50 print:border-zinc-200">
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wide">Student</div>
            <div className="text-sm font-semibold text-white mt-0.5 print:text-black">{receipt.studentName}</div>
            {receipt.batchName && (
              <div className="text-xs text-zinc-400 mt-0.5 print:text-zinc-600">
                {receipt.batchName} {receipt.sport ? `(${receipt.sport})` : ""}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wide">Parent / Guardian</div>
            <div className="text-sm font-medium text-zinc-200 mt-0.5 print:text-black">
              {receipt.parentName || "Parent"}
            </div>
            {receipt.parentPhone && (
              <div className="text-xs font-mono text-zinc-400 mt-0.5 print:text-zinc-600">
                {receipt.parentPhone}
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 border-b border-zinc-800/80 pb-2 print:border-zinc-300 print:text-zinc-700">
            Payment Details
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-zinc-300 print:text-zinc-800">
              Monthly Coaching Fee — <span className="font-medium text-white print:text-black">{formattedMonth}</span>
            </span>
            <span className="font-mono font-medium text-zinc-200 print:text-black">
              ₹{receipt.amount.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="border-t border-zinc-800/80 pt-3 mt-3 flex items-center justify-between text-base font-bold print:border-zinc-300">
            <span className="text-white print:text-black">Total Amount Paid</span>
            <span className="font-mono text-xl text-lime-400 print:text-emerald-700">
              ₹{receipt.amount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Verification & Transaction Metadata */}
        <div className="border-t border-zinc-800/80 pt-5 flex items-center justify-between print:border-zinc-300">
          <div className="space-y-1.5 text-xs text-zinc-400 print:text-zinc-600">
            <div>
              <span className="text-zinc-500">Mode:</span>{" "}
              <span className="text-zinc-300 font-medium print:text-black">{receipt.paymentMode}</span>
            </div>
            {receipt.transactionRef && (
              <div>
                <span className="text-zinc-500">Ref / Txn ID:</span>{" "}
                <span className="font-mono text-zinc-300 print:text-black">{receipt.transactionRef}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 pt-1 print:text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
              <span>Verified & Settled · Triq Sports OS</span>
            </div>
          </div>

          {/* QR Code Verification */}
          {qrDataUri && (
            <div className="flex flex-col items-center">
              <div className="p-1.5 bg-white rounded-lg shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUri} alt="Verification QR Code" width={84} height={84} className="rounded" />
              </div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-tight mt-1 print:text-zinc-500">
                Scan to Verify
              </span>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-4 border-t border-zinc-800/50 text-center text-[10px] text-zinc-500 print:border-zinc-200 print:text-zinc-500">
          This is a computer-generated, digitally verified receipt issued by {org?.name || "the academy"} on Triq Sports OS.
        </div>
      </div>

      {/* Script to hook up print button */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            const btn = document.getElementById("print-btn");
            if (btn) {
              btn.addEventListener("click", () => window.print());
            }
          `,
        }}
      />
    </div>
  );
}
