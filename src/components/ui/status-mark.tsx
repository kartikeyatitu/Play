import { Check } from "lucide-react";

/**
 * Confirmation states (Paid, Checked in, Session done): a small green check that fades in.
 * No stamps, bursts or bounce. `fresh` plays the 200ms fade once, right after the action.
 */
export function CheckMark({ size = 20, fresh = false, className = "" }: { size?: number; fresh?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-success/15 text-success ${fresh ? "fade-in" : ""} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Check style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={2.5} />
    </span>
  );
}

/** Compact "Paid" badge with a check. Children replace the label (e.g. "Paid 12 Oct · UPI"). */
export function PaidBadge({ children = "Paid", fresh = false, className = "" }: { children?: React.ReactNode; fresh?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 text-[12px] font-medium text-success ${fresh ? "fade-in" : ""} ${className}`}
    >
      <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />
      {children}
    </span>
  );
}
