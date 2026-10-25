import { paymentMethodLabel, isVerifiedOnline } from "@/lib/payment-method";
import { cn } from "@/lib/utils";

/**
 * Small "how was this paid" chip shown next to a PAID fee. Verified online money is green; anything
 * recorded or confirmed by staff is neutral, so owners can tell the two apart at a glance.
 * Renders nothing unless the fee is PAID.
 */
export function PaymentMethodBadge({
  status,
  method,
  className,
}: {
  status: string | null | undefined;
  method: string | null | undefined;
  className?: string;
}) {
  if (status !== "PAID") return null;
  const verified = isVerifiedOnline(method);
  return (
    <span
      data-testid="payment-method-badge"
      title="How this fee was paid"
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4",
        verified
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-zinc-700 bg-zinc-800/60 text-zinc-300",
        className,
      )}
    >
      {paymentMethodLabel(method)}
    </span>
  );
}
