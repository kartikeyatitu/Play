"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { reportFeePaid } from "@/app/actions/payments";
import { PayOnlineButton } from "@/components/parent/PayOnlineButton";
import { buildUpiLink } from "@/lib/fees";
import { Loader2, CreditCard, ShieldCheck, Smartphone, Copy, Clock } from "lucide-react";

/**
 * Parent-facing fee payment.
 * There is no payment gateway: the parent pays the academy directly over UPI, then taps
 * "I've paid". That only marks the fee as PENDING_VERIFICATION — the academy admin confirms it.
 * We never show "Payment Successful" here.
 */
export function CheckoutModal({
  feeRecordId,
  amount,
  month,
  status = "PENDING",
  studentName,
  academyName,
  upiId,
}: {
  feeRecordId: string;
  amount: number;
  month: string;
  status?: string;
  studentName?: string;
  academyName?: string | null;
  upiId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const payee = academyName || "Academy";
  const note = `${studentName ? studentName + " " : ""}fee ${month}`;
  const upiLink = upiId ? buildUpiLink({ upiId, payeeName: payee, amount, note }) : null;

  useEffect(() => {
    if (open && upiLink && !qr) {
      // Load the QR library on demand — only needed once the dialog is open.
      import("qrcode")
        .then((QRCode) => QRCode.toDataURL(upiLink, { margin: 1, width: 220 }))
        .then(setQr)
        .catch(() => setQr(null));
    }
  }, [open, upiLink, qr]);

  async function handleIvePaid() {
    setLoading(true);
    setError(null);
    const res = await reportFeePaid(feeRecordId);
    if (res?.success) setCurrentStatus(res.status || "PENDING_VERIFICATION");
    else setError(res?.error || "Something went wrong. Please try again.");
    setLoading(false);
  }

  const awaiting = currentStatus === "PENDING_VERIFICATION";
  const confirmed = currentStatus === "PAID";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={`inline-flex items-center justify-center rounded-md text-sm sm:text-xs font-bold ${awaiting ? "bg-sky-600 hover:bg-sky-700" : "bg-indigo-500 hover:bg-indigo-600"} text-white h-10 sm:h-7 px-3 w-full sm:w-auto ml-0 sm:ml-2 mt-2 sm:mt-0 transition`}>
          {awaiting ? <><Clock className="w-4 h-4 sm:w-3 sm:h-3 mr-1" /> Awaiting confirmation</> : <><CreditCard className="w-4 h-4 sm:w-3 sm:h-3 mr-1" /> Pay Now</>}
      </DialogTrigger>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Pay {payee} via UPI
          </DialogTitle>
        </DialogHeader>
        
        {confirmed ? (
          <div className="py-8 text-center space-y-3">
            <h3 className="text-xl font-bold text-emerald-400">Payment confirmed by the academy</h3>
            <p className="text-zinc-400 text-sm">{month} fee is marked as paid.</p>
          </div>
        ) : awaiting ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Thanks! Waiting for {payee} to confirm</h3>
            <p className="text-zinc-400 text-sm">
              We&apos;ve told the academy you paid ₹{amount} for {month}. It will show as paid once they confirm receiving it.
            </p>
          </div>
        ) : (
          <div className="space-y-5 py-4">
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-400">Academy Fee ({month})</span>
                <span className="font-bold text-lg">₹{amount}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-zinc-800 pt-2 mt-2">
                <span className="text-zinc-500">Platform Fee</span>
                <span className="text-zinc-400">₹0</span>
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="font-bold text-white">Total Due</span>
                <span className="font-black text-2xl text-lime-400">₹{amount}</span>
              </div>
            </div>

            {currentStatus === "PENDING" && (
              <PayOnlineButton
                feeRecordId={feeRecordId}
                amountLabel={`₹${amount.toLocaleString()}`}
                disabled={loading}
                onLaunch={() => setOpen(false)}
              />
            )}

            {upiId && upiLink ? (
              <>
                <div className="flex flex-col items-center gap-2">
                  {qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr} alt={`UPI QR for ${payee}`} className="w-44 h-44 rounded-lg bg-[#fff] p-2" />
                  ) : (
                    <div className="w-44 h-44 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                    </div>
                  )}
                  <span className="text-xs text-zinc-500">Scan with any UPI app</span>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(upiId); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="font-mono text-sm text-emerald-400 flex items-center gap-1 hover:text-emerald-300"
                  >
                    {upiId} <Copy className="w-3 h-3" /> {copied && <span className="text-[10px] text-zinc-400">copied</span>}
                  </button>
                </div>

                <a href={upiLink} className="block">
                  <Button className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-6 text-lg">
                    <Smartphone className="w-5 h-5 mr-2" /> Pay ₹{amount} in UPI app
                  </Button>
                </a>
              </>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                {payee} hasn&apos;t added a UPI ID yet. Please pay the academy directly (cash/UPI), then tap &quot;I&apos;ve paid&quot;.
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleIvePaid}
              disabled={loading}
              className="w-full border-zinc-700 text-zinc-200 hover:bg-zinc-900"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Updating…</> : "I've paid"}
            </Button>
            {error && <p className="text-center text-xs text-rose-400">{error}</p>}
            
            <p className="text-center text-xs text-zinc-600">
              Money goes directly to the academy. The academy confirms your payment.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
