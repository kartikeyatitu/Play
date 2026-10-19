// A5-ish 1200×1500 receipt image (next/og ImageResponse). The URL is public, keyed by the
// receipt's random 32-char token — the same token used for the receipt page at /r/<token>.
//
// Palette matches the new Triq design: off-white canvas, slate ink, burnt orange accent band.
// Note: the default OG font has no ₹ glyph, so amounts use "Rs." instead.

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getReceiptByToken } from "@/lib/receipt-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANVAS = "#F7F7F5"; // --n-950 (light)
const INK = "#0C111D";    // --n-0
const INK_MUTED = "#4B5565";
const INK_SUBTLE = "#5F6878";
const LINE = "#E7E5E4";
const ACCENT = "#D1440A"; // --a-400
const ACCENT_SOFT = "#FFECE0";

function monthLong(month: string): string {
  if (!month || !month.includes("-")) return month;
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? " " + ONES[o] : ""}`;
}
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(below100(r));
  return parts.join(" ");
}

/** Amount-in-words in Indian numbering (Lakh / Crore). Returns e.g. "Two Thousand Five Hundred". */
function amountInWords(n: number): string {
  n = Math.max(0, Math.round(n));
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1_000);
  n %= 1_000;
  const parts: string[] = [];
  if (crore) parts.push(`${below100(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getReceiptByToken(token);
  if (!data) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: CANVAS, color: INK, fontFamily: "sans-serif", fontSize: 48 }}>
          Receipt not found
        </div>
      ),
      { width: 1200, height: 1500 }
    );
  }

  const { receipt, org } = data;
  const academy = org?.name || "Academy";
  const logo = org?.logo || null;
  const amountFig = Math.round(receipt.amount).toLocaleString();
  const amountWords = `${amountInWords(receipt.amount)} Only`;
  const monthLabel = monthLong(receipt.month);
  const issued = new Date(receipt.issuedAt).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: CANVAS,
          color: INK,
          fontFamily: "sans-serif",
          padding: 72,
        }}
      >
        {/* Accent band */}
        <div style={{ display: "flex", height: 8, background: ACCENT, marginBottom: 48, borderRadius: 4 }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" width={72} height={72} style={{ borderRadius: 16, objectFit: "cover" }} />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  background: ACCENT_SOFT,
                  color: ACCENT,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {academy.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>{academy}</div>
              {org?.city ? (
                <div style={{ fontSize: 20, color: INK_MUTED, marginTop: 4 }}>
                  {org.city}{org.state ? `, ${org.state}` : ""}
                </div>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1, color: INK }}>Receipt</div>
            <div style={{ fontSize: 20, color: INK_MUTED, marginTop: 6 }}>#{receipt.receiptNumber}</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", height: 1, background: LINE, marginBottom: 40 }} />

        {/* Details grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 48 }}>
          <Row label="Student" value={receipt.studentName} />
          {receipt.batchName ? <Row label="Batch" value={receipt.batchName} /> : null}
          <Row label="For month" value={monthLabel} />
          <Row label="Paid on" value={issued} />
          <Row label="Mode" value={paymentModeLabel(receipt.paymentMode)} />
          {receipt.transactionRef ? <Row label="Reference" value={receipt.transactionRef} /> : null}
        </div>

        {/* Amount block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 32,
            borderRadius: 16,
            background: ACCENT_SOFT,
            border: `1px solid ${LINE}`,
            marginBottom: 48,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 20, color: INK_MUTED, textTransform: "uppercase", letterSpacing: 1.5 }}>Amount paid</div>
            <div style={{ fontSize: 64, fontWeight: 700, color: ACCENT, letterSpacing: -1 }}>Rs. {amountFig}</div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: INK_MUTED, marginTop: 12 }}>{amountWords}</div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ display: "flex", height: 1, background: LINE, marginBottom: 24 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 20, color: INK }}>Thank you —</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: INK, marginTop: 4 }}>{academy}</div>
            </div>
            <div style={{ display: "flex", fontSize: 16, color: INK_SUBTLE }}>Verify at /r/{receipt.token.slice(0, 8)}…</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 1500,
      headers: {
        "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div style={{ display: "flex", fontSize: 22, color: INK_MUTED }}>{label}</div>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: INK }}>{value}</div>
    </div>
  );
}

function paymentModeLabel(mode: string): string {
  switch (mode) {
    case "UPI": return "UPI";
    case "CASH": return "Cash";
    case "RAZORPAY": return "Razorpay";
    case "BANK_TRANSFER": return "Bank transfer";
    case "MANUAL": return "Recorded by admin";
    default: return mode || "—";
  }
}
