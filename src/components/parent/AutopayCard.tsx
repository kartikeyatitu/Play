"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelAutopayMandate, confirmAutopayAuthorisation, getAutopayForStudent, startAutopayMandate } from "@/app/actions/autopay";
import { AFA_THRESHOLD_MINOR, AUTH_AMOUNT_MINOR, consentText, type AutopayParentView } from "@/lib/autopay";
import { loadRazorpay } from "@/components/parent/PayOnlineButton";

const inr = (rupees: number) => `₹${rupees.toLocaleString("en-IN")}`;
const OPEN = ["CREATED", "AUTHENTICATED", "ACTIVE", "PAUSED"];

/** Parent fee screen: opt in to UPI AutoPay for one child (flag upiAutopay). Renders nothing when unavailable. */
export function AutopayCard({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [view, setView] = useState<AutopayParentView | null>(null);
  const [open, setOpen] = useState(false);
  const [maxRupees, setMaxRupees] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getAutopayForStudent(studentId);
      if (r.success) {
        setView(r);
        setMaxRupees((m) => m || String(r.suggestedMaxRupees));
      } else setView(null);
    } catch {
      setView(null);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const consent = useMemo(() => {
    if (!view) return "";
    const n = Number(maxRupees);
    return consentText({
      academyName: view.academyName,
      studentName: view.studentName,
      maxAmountLabel: Number.isFinite(n) && n > 0 ? inr(n) : "the limit you set",
      authAmountLabel: inr(AUTH_AMOUNT_MINOR / 100),
    });
  }, [view, maxRupees]);

  if (!view || !view.available) return null;
  const live = view.mandate && OPEN.includes(view.mandate.status) && view.mandate.status !== "CREATED" ? view.mandate : null;

  async function start() {
    if (busy || !view) return;
    setBusy(true);
    try {
      const res = await startAutopayMandate({ studentId, maxAmountRupees: Number(maxRupees), consent: agreed });
      if (!res.success) {
        toast.error(res.error);
        setBusy(false);
        return;
      }
      await loadRazorpay();
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) throw new Error("Razorpay unavailable");
      const rzp = new Razorpay({
        key: res.keyId,
        order_id: res.orderId,
        customer_id: res.customerId,
        recurring: "1",
        amount: res.amountMinor,
        currency: "INR",
        name: res.name,
        description: res.description,
        prefill: res.prefill,
        theme: { color: "#d1440a" },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const c = await confirmAutopayAuthorisation({ mandateId: res.mandateId, orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            if (c.success) toast.success(c.status === "ACTIVE" ? "UPI AutoPay is active." : "Approved. Your bank is confirming the mandate.");
            else toast.error(c.error);
          } finally {
            setBusy(false);
            setOpen(false);
            await load();
            router.refresh();
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", (resp: any) => {
        toast.error(resp?.error?.description || "AutoPay setup failed.");
        setBusy(false);
      });
      rzp.open();
    } catch {
      toast.error("Couldn't open the AutoPay setup. Please try again.");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!live || !confirm("Cancel UPI AutoPay? Future fees will need to be paid manually.")) return;
    setBusy(true);
    try {
      const r = await cancelAutopayMandate(live.id);
      if (!r.success) toast.error(r.error);
      else toast.success("AutoPay cancelled");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Repeat className="w-5 h-5 text-lime-400 mt-0.5 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-zinc-100">UPI AutoPay</h4>
          {live ? (
            <p className="text-xs text-zinc-400">
              {live.statusLabel} · up to {inr(live.maxAmountMinor / 100)} a month
            </p>
          ) : (
            <p className="text-xs text-zinc-400">Pay {view.studentName}&apos;s monthly fee automatically from your UPI app.</p>
          )}
        </div>
        {live ? (
          <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
        ) : (
          !open && (
            <Button type="button" size="sm" onClick={() => setOpen(true)}>
              Set up
            </Button>
          )
        )}
      </div>

      {!live && open && (
        <div className="space-y-3">
          <label className="block text-xs text-zinc-400">
            Maximum per month (₹)
            <Input value={maxRupees} onChange={(e) => setMaxRupees(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" />
            {view.currentFeeMinor > 0 && <span>This month&apos;s fee: {inr(view.currentFeeMinor / 100)}</span>}
          </label>
          {Number(maxRupees) * 100 > AFA_THRESHOLD_MINOR && (
            <p className="text-xs text-amber-400">Debits above ₹15,000 need your UPI PIN each time.</p>
          )}
          <p className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-xs leading-relaxed text-zinc-300">{consent}</p>
          <label className="flex items-start gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            I have read and agree to the above.
          </label>
          <div className="flex gap-2">
            <Button type="button" onClick={start} disabled={!agreed || busy || !maxRupees}>
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Continue to UPI app
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Not now
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
