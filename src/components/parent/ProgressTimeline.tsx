"use client";

import { Card, CardContent } from "@/components/ui/card";
import { unifyMetrics } from "@/lib/sport-metrics";

export type Report = {
  month: string;
  technique: number;
  fitness: number;
  discipline: number;
  notes: string;
  createdAt: Date;
  sport?: string | null;
  metrics?: Record<string, number> | null;
};

type Props = {
  reports: Report[];
  sport?: string | null;
};

export function ProgressTimeline({ reports, sport }: Props) {
  if (!reports || reports.length === 0) {
    return (
      <Card className="bg-zinc-950 border-zinc-800">
        <CardContent className="pt-6">
          <p className="text-zinc-500 text-center">No evaluations yet</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by date descending
  const sortedReports = [...reports].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-4">
      <div className="relative border-l-2 border-zinc-800 ml-4 pl-6 space-y-8 py-4">
        {sortedReports.map((report, idx) => {
          const unified = unifyMetrics(
            sport ?? report.sport,
            { technique: report.technique, fitness: report.fitness, discipline: report.discipline },
            report.metrics as Record<string, number> | undefined
          );

          return (
            <div key={idx} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-lime-500 border-4 border-zinc-950" />

              <Card className="bg-zinc-900/40 border-zinc-800">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-zinc-100">{report.month}</h3>
                  </div>

                  <div className="space-y-3">
                    {unified.map((skill) => (
                      <div key={skill.key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-300">{skill.label}</span>
                          <span className="text-zinc-500">{skill.value}/5</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-700"
                            style={{ width: `${(skill.value / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {report.notes && (
                    <p className="text-zinc-400 text-sm bg-zinc-950 p-3 rounded-md border border-zinc-800/50">
                      {report.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
