"use client";

import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Shares the public coach profile (/c/{coachId}) via Web Share, falling back to WhatsApp. */
export function CoachShareProfileButton({
  coachId,
  coachName,
  academyName,
  className,
}: {
  coachId: string;
  coachName: string;
  academyName: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    const url = `${window.location.origin}/c/${encodeURIComponent(coachId)}`;
    const text = `${coachName} · ${academyName}. See my batches & timings and book a free trial:`;
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: `${coachName} · ${academyName}`, text, url });
          return;
        } catch (err) {
          if ((err as { name?: string } | null)?.name === "AbortError") return;
          // fall through to WhatsApp
        }
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't open the share sheet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className={`h-11 w-full rounded-2xl bg-[var(--brand)] text-[var(--brand-foreground)] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-opacity ${className || ""}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
      Share my coach card
    </button>
  );
}
