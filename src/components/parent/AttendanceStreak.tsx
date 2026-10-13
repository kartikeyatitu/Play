"use client";

import { Badge } from "@/components/ui/badge";

interface AttendanceStreakProps {
  attendances: { isPresent: boolean }[];
}

export function AttendanceStreak({ attendances }: AttendanceStreakProps) {
  let streak = 0;
  for (const record of attendances) {
    if (record.isPresent) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 10) {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
        🔥 LEGENDARY STREAK: {streak}
      </Badge>
    );
  }

  if (streak >= 3) {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
        🔥 {streak} session streak!
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-zinc-800 text-zinc-400 border-zinc-700">
      Keep going! {streak} sessions
    </Badge>
  );
}
