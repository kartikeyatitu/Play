"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AchievementBadgesProps {
  attendances: { isPresent: boolean }[];
  points: number;
  skillReports: { technique: number; fitness: number; discipline: number }[];
}

export function AchievementBadges({ attendances, points, skillReports }: AchievementBadgesProps) {
  const attended = attendances.filter(a => a.isPresent).length;
  const total = attendances.length;
  const pct = total > 0 ? (attended / total) * 100 : 0;
  
  // Calculate streak
  let streak = 0;
  for (const a of attendances) {
    if (a.isPresent) streak++;
    else break;
  }

  // Calculate avg skill
  const avgSkill = skillReports.length > 0
    ? skillReports.reduce((sum, r) => sum + (r.technique + r.fitness + r.discipline) / 3, 0) / skillReports.length
    : 0;

  // Define all possible badges
  const allBadges = [
    { emoji: "🔥", name: "5-Day Streak", desc: "Attended 5+ sessions in a row", earned: streak >= 5 },
    { emoji: "⭐", name: "10-Day Streak", desc: "Attended 10+ sessions in a row", earned: streak >= 10 },
    { emoji: "🏆", name: "Century Club", desc: "Earned 100+ points", earned: points >= 100 },
    { emoji: "💎", name: "Diamond Player", desc: "Earned 500+ points", earned: points >= 500 },
    { emoji: "🎯", name: "Sharp Shooter", desc: "Avg skill rating 4+", earned: avgSkill >= 4 },
    { emoji: "💪", name: "Iron Will", desc: "90%+ attendance rate", earned: pct >= 90 },
    { emoji: "📈", name: "Rising Star", desc: "50+ points earned", earned: points >= 50 },
    { emoji: "🌟", name: "Perfect Score", desc: "Avg skill rating 5", earned: avgSkill >= 4.8 },
    { emoji: "🏃", name: "First Steps", desc: "Attended first session", earned: attended >= 1 },
    { emoji: "👏", name: "Consistent", desc: "75%+ attendance", earned: pct >= 75 },
  ];

  const earned = allBadges.filter(b => b.earned);
  const locked = allBadges.filter(b => !b.earned);

  return (
    <Card className="bg-zinc-900/30 border-zinc-800/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-zinc-400">🏅 Achievements</CardTitle>
      </CardHeader>
      <CardContent>
        {earned.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {earned.map(badge => (
              <div key={badge.name} className="bg-emerald-500/10 border border-emerald-800/30 rounded-lg p-3 text-center">
                <span className="text-2xl">{badge.emoji}</span>
                <p className="text-xs font-semibold text-emerald-400 mt-1">{badge.name}</p>
                <p className="text-[10px] text-zinc-500">{badge.desc}</p>
              </div>
            ))}
          </div>
        )}
        {locked.length > 0 && (
          <div>
            <p className="text-xs text-zinc-600 mb-2">🔒 Locked</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {locked.map(badge => (
                <div key={badge.name} className="bg-zinc-800/30 border border-zinc-800/50 rounded-lg p-2 text-center opacity-40">
                  <span className="text-xl grayscale">{badge.emoji}</span>
                  <p className="text-[10px] text-zinc-500 mt-1">{badge.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
