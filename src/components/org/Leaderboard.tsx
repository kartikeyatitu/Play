"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LeaderboardProps {
  students: { id: string; name: string; points: number }[];
}

export function Leaderboard({ students }: LeaderboardProps) {
  const sorted = [...students].sort((a, b) => b.points - a.points).slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];

  if (sorted.length === 0) {
    return (
      <Card className="bg-zinc-900/30 border-zinc-800/50">
        <CardContent className="p-6 text-center text-zinc-500">
          No students yet. Add students to see the leaderboard.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/30 border-zinc-800/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          🏆 Student Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((student, i) => {
          const maxPoints = sorted[0]?.points || 1;
          const barWidth = Math.max(10, (student.points / maxPoints) * 100);
          
          return (
            <div key={student.id} className="flex items-center gap-3">
              <span className="text-lg w-8 text-center">{medals[i] || `${i + 1}.`}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{student.name}</span>
                  <Badge variant={i === 0 ? "lime" : i < 3 ? "sky" : "outline"}>
                    {student.points} pts
                  </Badge>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      i === 0 ? "bg-gradient-to-r from-yellow-400 to-amber-500" :
                      i === 1 ? "bg-gradient-to-r from-zinc-300 to-zinc-400" :
                      i === 2 ? "bg-gradient-to-r from-amber-600 to-amber-700" :
                      "bg-emerald-500"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
