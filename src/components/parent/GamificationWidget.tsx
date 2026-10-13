"use client";
import { Trophy, Apple } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function GamificationWidget({ student, leaderboard }: { student: any, leaderboard: any[] }) {
  const rank = leaderboard.findIndex(s => s.id === student.id) + 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {/* LEADERBOARD */}
      <Card className="bg-zinc-950 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3 text-amber-500 font-bold uppercase tracking-widest text-xs">
            <Trophy className="w-4 h-4" /> Academy Leaderboard
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-amber-400">{student.points} <span className="text-sm font-medium text-zinc-500">PTS</span></p>
              <p className="text-zinc-400 text-sm">Overall Rank: #{rank > 0 ? rank : "-"}</p>
            </div>
            <div className="space-y-1 text-right">
              {leaderboard.slice(0, 3).map((s, i) => (
                <div key={s.id} className={`text-xs ${i === 0 ? "text-amber-300 font-bold" : "text-zinc-500"}`}>
                  {i + 1}. {s.name.split(' ')[0]} ({s.points})
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DIET PLAN */}
      <Card className="bg-zinc-950 border-emerald-500/20">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 mb-2 text-emerald-500 font-bold uppercase tracking-widest text-xs">
            <Apple className="w-4 h-4" /> Nutrition
          </div>
          {student.dietPlanUrl ? (
            <a href={student.dietPlanUrl} target="_blank" className="text-emerald-400 text-sm hover:underline font-medium">
              View Active Diet Plan →
            </a>
          ) : (
            <p className="text-zinc-600 text-sm italic">No diet plan assigned.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
