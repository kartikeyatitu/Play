import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { CheckCircle2, Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { verifyPayToken } from "@/lib/pay-token";
import { buildUpiLink, isValidUpiId } from "@/lib/fees";
import { monthLabel } from "@/lib/fee-reminders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay fees | TRIQ", robots: { index: false, follow: false } };

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Opened from a WhatsApp fee reminder. Shows what is due for one family and opens the UPI app with the
 * amount filled in. First names only; the link expires after 30 days.
 */
export default async function PayPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const who = verifyPayToken(decodeURIComponent(token));
  if (!who) return <Shell title="This link has expired">Ask the academy for a new reminder, or <Link href="/login" className="font-semibold underline">log in</Link> to pay.</Shell>;

  const [org, fees] = await Promise.all([
    db.organization.findUnique({ where: { id: who.orgId }, select: { name: true, upiId: true, logo: true } }),
    db.feeRecord.findMany({
      where: { orgId: who.orgId, status: { notIn: ["PAID", "PENDING_VERIFICATION"] }, amount: { gt: 0 }, student: { parentId: who.familyId, orgId: who.orgId } },
      select: { id: true, month: true, amount: true, student: { select: { name: true } } },
      orderBy: { month: "asc" },
    }),
  ]);
  if (!org) return <Shell title="This link has expired">Ask the academy for a new reminder.</Shell>;

  if (fees.length === 0) {
    return (
      <Shell title="All paid. Thank you!">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" aria-hidden />
        Nothing is due at {org.name} right now.
      </Shell>
    );
  }

  const total = fees.reduce((s, f) => s + f.amount, 0);
  const canUpi = !!org.upiId && isValidUpiId(org.upiId);
  const upi = canUpi ? buildUpiLink({ upiId: org.upiId!, payeeName: org.name, amount: total, note: "Academy fees" }) : null;
  const qr = upi ? await QRCode.toDataURL(upi, { margin: 1, width: 360 }) : null;

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink">
      <div className="mx-auto max-w-sm">
        <p className="text-center text-sm text-ink-muted">{org.name}</p>
        <h1 className="mt-1 text-center text-4xl font-bold tabular-nums">{rupees(total)}</h1>
        <p className="mt-1 text-center text-sm text-ink-muted">due now</p>

        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {fees.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                {(f.student.name || "").split(" ")[0]} <span className="text-ink-muted">{monthLabel(f.month)}</span>
              </span>
              <span className="font-semibold tabular-nums">{rupees(f.amount)}</span>
            </li>
          ))}
        </ul>

        {upi ? (
          <>
            <a href={upi} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl brand-bg text-base font-bold">
              <Smartphone className="h-5 w-5" aria-hidden /> Pay {rupees(total)} with a UPI app
            </a>
            <p className="mt-2 text-center text-xs text-ink-subtle">Opens GPay, PhonePe, Paytm or BHIM with the amount filled in.</p>
            {qr && (
              <figure className="mt-6 rounded-2xl border border-line bg-[#ffffff] p-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={`UPI QR code to pay ${rupees(total)} to ${org.name}`} className="mx-auto h-48 w-48" />
                <figcaption className="mt-2 text-xs text-[#4a5d54]">On a computer? Scan with your phone. UPI ID: {org.upiId}</figcaption>
              </figure>
            )}
            <p className="mt-6 text-center text-sm text-ink-muted">
              Paid? The academy will confirm it. You can also <Link href="/login" className="font-semibold underline">log in</Link> and share the payment reference.
            </p>
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-line bg-surface p-4 text-center text-sm text-ink-muted">
            <Link href="/login" className="font-semibold underline">Log in</Link> to pay online, or pay at the front desk.
          </p>
        )}
      </div>
    </main>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 text-ink">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-2 text-ink-muted">{children}</div>
      </div>
    </main>
  );
}
