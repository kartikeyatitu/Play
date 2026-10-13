"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { markFeePaid, confirmFeePayment, rejectFeePayment } from "@/app/actions/payments";
import { createFeePaymentLink, syncFeePaymentLink } from "@/app/actions/payment-links";
import { buildUpiLink } from "@/lib/fees";
import {
  Download,
  Share2,
  CheckCircle2,
  IndianRupee,
  QrCode,
  Clock,
  Link2,
  Loader2,
  Copy,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface PayNowButtonProps {
  studentName: string;
  studentId: string;
  amount: number;
  month: string;
  parentPhone: string;
  /** Academy details for the UPI request (optional for backwards compatibility) */
  academyName?: string | null;
  upiId?: string | null;
  /** Current fee record (if any) so the admin can confirm/reject a parent's "I've paid" */
  feeRecordId?: string | null;
  feeStatus?: string | null;
  razorpayConnected?: boolean;
}

/**
 * Admin-side "collect fee" dialog.
 * Shows the academy's UPI QR / payment request (to show in person or share on WhatsApp)
 * and lets the admin record the payment once the money is actually received.
 * If the parent tapped "I've paid", the admin can Confirm (→ PAID) or Reject (→ PENDING).
 */
export function PayNowButton({
  studentName,
  studentId,
  amount,
  month,
  parentPhone,
  academyName,
  upiId,
  feeRecordId,
  feeStatus,
  razorpayConnected,
}: PayNowButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [receiptData, setReceiptData] = useState<{ receiptNumber: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState(feeStatus || "PENDING");

  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const payee = academyName || "Academy";
  const upiLink = upiId && amount > 0
    ? buildUpiLink({ upiId, payeeName: payee, amount, note: `${studentName} fee ${month}` })
    : null;

  useEffect(() => {
    if (isOpen && upiLink && !qr) {
      // Load the QR library on demand — it's only needed once the dialog is open.
      import("qrcode")
        .then((QRCode) => QRCode.toDataURL(upiLink, { margin: 1, width: 200 }))
        .then(setQr)
        .catch(() => setQr(null));
    }
  }, [isOpen, upiLink, qr]);

  const handlePayClick = async () => {
    setIsOpen(true);
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    setError(null);
    try {
      const res = await createFeePaymentLink(studentId, month);
      if (res.success) {
        setPaymentLink(res.url);
        toast.success(res.reused ? "Payment link ready." : "Payment link generated!");
      } else {
        toast.error(res.error || "Could not generate payment link.");
        setError(res.error || null);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create payment link.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    setError(null);
    try {
      const res = await syncFeePaymentLink(studentId, month);
      if (res.success && res.paid) {
        toast.success("Payment confirmed as PAID on Razorpay!");
        setPaymentRef("razorpay_verified");
        setStatus("PAID");
        setIsSuccess(true);
      } else if (res.success) {
        toast.info(res.status === "no_link" ? "No payment link found." : "Payment is not yet completed.");
      } else {
        toast.error(res.error || "Could not verify payment status.");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to check payment status.");
    } finally {
      setCheckingStatus(false);
    }
  };

  // Admin records a payment that was actually received (cash / UPI seen in bank app)
  const handleManualPayment = async () => {
    setIsLoading(true);
    setError(null);
    const refId = `manual_${Date.now().toString().slice(-6)}`;
    const res = status === "PENDING_VERIFICATION" && feeRecordId
      ? await confirmFeePayment(feeRecordId)
      : await markFeePaid(studentId, month, refId);
    
    if (res.success) {
      setPaymentRef(refId);
      setStatus("PAID");
      if ((res as any).receipt) {
        setReceiptData((res as any).receipt);
      }
      setIsSuccess(true);
    } else {
      setError((res as any).error || "Could not record payment.");
    }
    setIsLoading(false);
  };

  const handleReject = async () => {
    if (!feeRecordId) return;
    setIsLoading(true);
    const res = await rejectFeePayment(feeRecordId);
    if (res.success) setStatus("PENDING");
    else setError((res as any).error || "Could not update.");
    setIsLoading(false);
  };

  const cleanPhone = (parentPhone || "").replace(/\D/g, "");
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const whatsappMessage = encodeURIComponent(
    `Hi, the ${month} fee for ${studentName} is ₹${amount}.` +
      (upiId ? `\nPay via UPI to ${upiId}${upiLink ? `\nTap to pay: ${upiLink}` : ""}` : "") +
      `\nAfter paying, tap "I've paid" in the parent app or reply here.\n— ${payee}`
  );

  return (
    <>
      <Button 
        onClick={handlePayClick}
        className={`${status === "PENDING_VERIFICATION" ? "bg-sky-600 hover:bg-sky-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white shadow-md transition-all`}
        size="sm"
      >
        {status === "PENDING_VERIFICATION" ? <Clock className="w-4 h-4 mr-1" /> : <IndianRupee className="w-4 h-4 mr-1" />}
        {status === "PENDING_VERIFICATION" ? "Verify ₹" : "Collect ₹"}{amount}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
          {!isSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold">
                  {status === "PENDING_VERIFICATION" ? "Parent says they've paid" : "Collect Fee"}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-5 py-2">
                <div className="text-center">
                  <div className="text-sm text-zinc-400 mb-1">Fee for {studentName} ({month})</div>
                  <div className="text-3xl font-bold text-white flex items-center justify-center">
                    ₹{amount}
                  </div>
                  {amount <= 0 && (
                    <div className="text-xs text-amber-400 mt-1">Fee not set — set a batch fee or academy default in Settings.</div>
                  )}
                </div>

                {/* Razorpay 1-Click Payment Link Section */}
                {razorpayConnected ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                        <span>Razorpay Payment Link</span>
                      </div>
                      <span className="text-[11px] text-zinc-400">UPI / Card / NetBanking</span>
                    </div>

                    {!paymentLink ? (
                      <Button
                        type="button"
                        onClick={handleGenerateLink}
                        disabled={generatingLink || amount <= 0}
                        className="w-full bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm h-10 shadow-sm"
                      >
                        {generatingLink ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating Link…
                          </>
                        ) : (
                          <>
                            <Link2 className="w-4 h-4 mr-2" /> Create Razorpay Link
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            readOnly
                            value={paymentLink}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono select-all focus:outline-none"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(paymentLink);
                              setCopiedLink(true);
                              toast.success("Link copied!");
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shrink-0 h-8"
                          >
                            {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                              `Hi, please pay the ${month} fee (₹${amount}) for ${studentName} using this secure link:\n${paymentLink}\n\nAccepted: UPI, Cards, NetBanking.\n— ${payee}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full block"
                          >
                            <Button
                              type="button"
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9"
                            >
                              <Share2 className="w-3.5 h-3.5 mr-1.5" /> WhatsApp Link
                            </Button>
                          </a>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCheckStatus}
                            disabled={checkingStatus}
                            className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs h-9"
                          >
                            {checkingStatus ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Check Status
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-2.5 flex items-center justify-between">
                    <span>💡 Tip: Connect Razorpay in Settings to generate instant 1-click payment links.</span>
                  </div>
                )}

                {/* Direct UPI QR Code Box */}
                <div className="grid gap-3">
                  <div className="flex flex-col items-center justify-center p-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/40">
                    {upiLink && qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr} alt="UPI QR" className="w-32 h-32 rounded-lg bg-white p-2 mb-2" />
                    ) : (
                      <QrCode className="w-20 h-20 text-zinc-500 mb-2" />
                    )}
                    <span className="text-xs text-zinc-400">
                      {upiId ? "Scan with any UPI app in person" : "Add your UPI ID in Settings to show a QR"}
                    </span>
                    {upiId && <span className="font-mono mt-1 text-xs text-emerald-400">{upiId}</span>}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <a href={`https://wa.me/${waPhone}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" className="w-full block">
                    <Button
                      variant="outline"
                      className="w-full border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs h-9"
                    >
                      <Share2 className="w-3.5 h-3.5 mr-2" />
                      Send raw UPI text on WhatsApp
                    </Button>
                  </a>
                  
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9"
                    onClick={handleManualPayment}
                    disabled={isLoading}
                  >
                    {isLoading ? "Saving..." : status === "PENDING_VERIFICATION" ? "Confirm — money received" : "Mark as paid (cash / bank received)"}
                  </Button>
                  {status === "PENDING_VERIFICATION" && feeRecordId && (
                    <Button
                      variant="outline"
                      className="w-full border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs h-9"
                      onClick={handleReject}
                      disabled={isLoading}
                    >
                      Reject — not received
                    </Button>
                  )}
                  {error && <p className="text-xs text-center text-rose-400">{error}</p>}
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold text-emerald-400">Payment Recorded</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4 flex flex-col items-center">
                <CheckCircle2 className="w-20 h-20 text-emerald-500" />
                
                <Card className="w-full p-6 bg-zinc-900 border-zinc-800 space-y-3">
                  <div className="text-center pb-4 border-b border-zinc-800">
                    <div className="font-bold text-lg text-white">{payee}</div>
                    <div className="text-sm text-zinc-400">Fee Receipt</div>
                  </div>
                  
                  <div className="flex justify-between text-sm text-zinc-300">
                    <span>Student:</span>
                    <span className="font-medium text-white">{studentName}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-300">
                    <span>Month:</span>
                    <span className="font-medium text-white">{month}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-300">
                    <span>Date:</span>
                    <span className="font-medium text-white">{new Date().toLocaleDateString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-300">
                    <span>Receipt No:</span>
                    <span className="font-mono text-xs text-lime-400 font-semibold">{receiptData?.receiptNumber || paymentRef}</span>
                  </div>
                  
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-zinc-800 text-white">
                    <span>Amount Paid:</span>
                    <span className="text-lime-400">₹{amount.toLocaleString("en-IN")}</span>
                  </div>
                </Card>

                <div className="flex flex-col gap-2 w-full">
                  {receiptData?.url && (
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <a
                        href={receiptData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        <Button
                          variant="outline"
                          className="w-full border-lime-500/40 bg-lime-500/10 text-lime-400 hover:bg-lime-500/20 text-xs h-9"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> View Receipt
                        </Button>
                      </a>
                      <a
                        href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                          `Namaste! Here is the verified fee payment receipt for ${studentName} (${month}):\nhttps://triqsports.vercel.app${receiptData.url}\n— ${payee}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        <Button
                          variant="outline"
                          className="w-full border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs h-9"
                        >
                          <Share2 className="w-3.5 h-3.5 mr-1.5" /> WhatsApp Receipt
                        </Button>
                      </a>
                    </div>
                  )}
                  <Button
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs h-9"
                    onClick={() => setIsOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
