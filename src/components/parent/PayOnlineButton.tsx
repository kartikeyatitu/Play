"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getOnlinePaymentOptions,
  startOnlineFeePayment,
  confirmRazorpayCheckout,
} from "@/app/actions/online-payments";

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (r: any) => void) => void;
};

type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let razorpayLoader: Promise<void> | null = null;

/** Lazy-loads Razorpay Checkout exactly once per page (shared promise guards double insert). */
function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).Razorpay) return Promise.resolve();
  if (razorpayLoader) return razorpayLoader;
  razorpayLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => resolve();
    const onError = () => {
      razorpayLoader = null; // allow a retry
      script.remove();
      reject(new Error("Failed to load Razorpay"));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = RAZORPAY_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
  return razorpayLoader;
}

/**
 * "Pay online" button for a pending monthly fee. Renders nothing unless the server reports
 * at least one configured gateway. The amount is never sent from or trusted on the client —
 * the server derives it from the fee record.
 */
export function PayOnlineButton({
  feeRecordId,
  amountLabel,
  disabled,
  onLaunch,
}: {
  feeRecordId: string;
  amountLabel: string;
  disabled?: boolean;
  /** Optional hook fired right before the gateway UI opens (e.g. to close a parent dialog). */
  onLaunch?: () => void;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getOnlinePaymentOptions(feeRecordId)
      .then((o) => {
        if (!cancelled) setEnabled(Boolean(o?.razorpay || o?.stripe));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  function release() {
    busy.current = false;
    setLoading(false);
  }

  async function handleClick() {
    if (busy.current || disabled) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await startOnlineFeePayment(feeRecordId);
      if (!res.success) {
        toast.error(res.error || "Could not start the payment. Please try again.");
        release();
        return;
      }

      if (res.provider === "STRIPE") {
        window.location.href = res.url; // keep the loading state while we navigate away
        return;
      }

      await loadRazorpay();
      const Razorpay = (window as any).Razorpay as RazorpayCtor | undefined;
      if (!Razorpay) throw new Error("Razorpay unavailable");

      const rzp = new Razorpay({
        key: res.keyId,
        amount: res.amountMinor,
        currency: res.currency,
        name: res.name,
        description: res.description,
        order_id: res.orderId,
        prefill: res.prefill,
        theme: { color: "#d1440a" },
        handler: async (r: RazorpayResponse) => {
          try {
            const confirm = await confirmRazorpayCheckout({
              orderId: r.razorpay_order_id,
              paymentId: r.razorpay_payment_id,
              signature: r.razorpay_signature,
            });
            if (confirm?.success) toast.success("Payment received. Thank you!");
            else toast.error(confirm?.error || "We could not verify your payment. If money was debited, it will update shortly.");
          } catch {
            toast.error("We could not verify your payment. If money was debited, it will update shortly.");
          } finally {
            router.refresh();
            release();
          }
        },
        modal: {
          ondismiss: () => {
            toast("Payment cancelled");
            release();
          },
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        toast.error(resp?.error?.description || "Payment failed. Please try again.");
        release();
      });
      onLaunch?.();
      rzp.open();
    } catch {
      toast.error("Could not start the payment. Please try again.");
      release();
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className="w-full h-12 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-base"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Opening secure checkout…
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4 mr-2" /> Pay online {amountLabel}
        </>
      )}
    </Button>
  );
}
