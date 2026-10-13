"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { syncStripeCheckout } from "@/app/actions/online-payments";

/**
 * Handles the redirect back from Stripe Checkout (`?pay=stripe&session_id=...` / `?pay=cancelled`).
 * Renders nothing. Must be mounted inside <Suspense> because of useSearchParams.
 */
export function PaymentReturnHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const handled = useRef<string | null>(null);

  const pay = params.get("pay");
  const sessionId = params.get("session_id");

  useEffect(() => {
    if (pay === "stripe" && sessionId) {
      if (handled.current === sessionId) return; // strict-mode / re-render guard
      handled.current = sessionId;
      (async () => {
        try {
          const res = await syncStripeCheckout(sessionId);
          if (!res?.success) toast.error(res?.error || "We could not confirm your payment. Please check again shortly.");
          else if (res.paid) toast.success("Payment received");
          else toast("Payment is still processing, we will update shortly");
        } catch {
          toast.error("We could not confirm your payment. Please check again shortly.");
        } finally {
          router.refresh();
          router.replace("/parent");
        }
      })();
    } else if (pay === "cancelled") {
      if (handled.current === "cancelled") return;
      handled.current = "cancelled";
      toast("Payment cancelled");
      router.replace("/parent");
    }
  }, [pay, sessionId, router]);

  return null;
}
