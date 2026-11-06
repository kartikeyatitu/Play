import { ShieldCheck, UserRound } from "lucide-react";
import type { Verification } from "@/lib/athlete/passport-build";

/** Verified (academy staff checked it) vs self-reported (added by a parent or coach, not verified yet). */
export function VerificationBadge({ verification, compact = false }: { verification: Verification; compact?: boolean }) {
  if (verification === "VERIFIED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        <ShieldCheck className="h-3 w-3" aria-hidden />
        {compact ? "Verified" : "Verified by academy"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
      <UserRound className="h-3 w-3" aria-hidden />
      Self-reported
    </span>
  );
}
