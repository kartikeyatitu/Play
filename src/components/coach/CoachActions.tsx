"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { awardPoints } from "@/app/actions/gamification";
import { Trophy, Loader2 } from "lucide-react";

export function CoachActions({ studentId, studentName, className = "" }: { studentId: string; studentName?: string; className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAward() {
    setLoading(true);
    try {
      const res = (await awardPoints(studentId, 10)) as { success?: boolean; error?: string } | undefined;
      if (res && res.success === false) {
        toast.error(res.error || "Could not award points.");
      } else {
        toast.success(`+10 points${studentName ? ` to ${studentName.split(" ")[0]}` : ""} 🏆`);
        router.refresh();
      }
    } catch {
      toast.error("Could not award points.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={handleAward}
        disabled={loading}
        className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 h-8 text-xs font-bold px-2.5 rounded-xl border border-amber-500/30 transition-colors shrink-0 flex items-center gap-1 disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trophy className="w-3 h-3" />} +10 PTS
      </button>
    </div>
  );
}
