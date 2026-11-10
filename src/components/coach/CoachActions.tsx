"use client";
// Coach quick action on an athlete: a rewards bonus (Rewards is the one points system).
import { Trophy } from "lucide-react";
import { CoachAwardSheet } from "@/components/rewards/CoachAwardSheet";

export function CoachActions({ studentId, studentName, className = "" }: { studentId: string; studentName?: string; className?: string }) {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      <CoachAwardSheet
        players={[{ id: studentId, name: studentName || "Athlete" }]}
        trigger={
          <span className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 h-8 text-xs font-bold px-2.5 rounded-xl border border-amber-500/30 transition-colors shrink-0 flex items-center gap-1">
            <Trophy className="w-3 h-3" /> Bonus
          </span>
        }
      />
    </div>
  );
}
