"use client";

import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Batch {
  sessions: any[];
  enrollments: any[];
}

interface Coach {
  name: string;
  batches: Batch[];
}

interface CoachPerformanceProps {
  coaches: Coach[];
  /** Academy's per-session coach rate (₹). null/undefined → payout shown as "—". */
  sessionRate?: number | null;
}

export function CoachPerformance({ coaches, sessionRate }: CoachPerformanceProps) {
  const stats = coaches.map(coach => {
    const totalSessions = coach.batches?.reduce((acc: number, batch: any) => acc + (batch.sessions?.length || 0), 0) || 0;
    const totalStudents = coach.batches?.reduce((acc: number, batch: any) => acc + (batch.enrollments?.length || 0), 0) || 0;
    const ratio = totalStudents > 0 ? (totalSessions / totalStudents).toFixed(2) : "0.00";
    const payout = sessionRate != null ? totalSessions * sessionRate : null;

    return {
      name: coach.name,
      totalSessions,
      totalStudents,
      ratio,
      payout
    };
  });

  // Rank by total sessions descending
  stats.sort((a, b) => b.totalSessions - a.totalSessions);

  return (
    <Card className="bg-zinc-900/40 border-zinc-800 p-6 overflow-hidden">
      <h2 className="text-xl font-semibold text-zinc-100 mb-4">Coach Performance Metrics</h2>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Coach Name</TableHead>
              <TableHead className="text-zinc-400">Sessions</TableHead>
              <TableHead className="text-zinc-400">Students</TableHead>
              <TableHead className="text-zinc-400">Ratio (Sess/Stud)</TableHead>
              <TableHead className="text-zinc-400">Est. Payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((coach, idx) => (
              <TableRow key={coach.name} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                <TableCell className="font-medium text-zinc-200">
                  <div className="flex items-center gap-2">
                    {coach.name}
                    {idx === 0 && stats.length > 1 && coach.totalSessions > 0 && (
                      <Badge variant="amber" className="bg-amber-500/20 text-amber-400 border-amber-500/50">
                        Top Performer
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-zinc-300">{coach.totalSessions}</TableCell>
                <TableCell className="text-zinc-300">{coach.totalStudents}</TableCell>
                <TableCell className="text-zinc-300">{coach.ratio}</TableCell>
                <TableCell className="text-zinc-300">{coach.payout != null ? `₹${coach.payout.toLocaleString("en-IN")}` : "—"}</TableCell>
              </TableRow>
            ))}
            {stats.length === 0 && (
              <TableRow className="border-none hover:bg-transparent">
                <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                  No coach data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
