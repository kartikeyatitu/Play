"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BatchHealthReport({ data }: { data?: any }) {
  const batches = data?.batches || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-100">Batch Health Report</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {batches.map((batch: any, i: number) => {
          const { name, fillRate, attendanceRate, trend } = batch;

          const getProgressColor = (rate: number) => {
            if (rate > 80) return 'bg-emerald-500';
            if (rate > 50) return 'bg-amber-500';
            return 'bg-rose-500';
          };

          let healthEmoji = '🟢';
          let healthText = 'Healthy';
          let recommendation = 'Great! Consider opening another batch';

          if (fillRate != null && fillRate < 40) {
            healthEmoji = '🔴';
            healthText = 'Critical';
            recommendation = 'Consider merging with a similar batch';
          } else if (attendanceRate < 60) {
            healthEmoji = '🟡';
            healthText = 'Needs Attention';
            recommendation = 'Schedule parent meeting for at-risk students';
          }

          return (
            <Card key={i} className="bg-zinc-900/40 border-zinc-800">
              <CardHeader className="pb-4 border-b border-zinc-800">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg text-zinc-100">{name}</CardTitle>
                    <div className="text-sm text-zinc-400 mt-1">
                      Health: {healthEmoji} {healthText}
                    </div>
                  </div>
                  <Badge variant="outline">{trend === 'up' ? '📈 Trending Up' : '📉 Trending Down'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Fill Rate</span>
                    <span className="text-zinc-100">{fillRate != null ? `${fillRate.toFixed(0)}%` : "— (set capacity)"}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${getProgressColor(fillRate ?? 0)}`} style={{ width: `${Math.min(fillRate ?? 0, 100)}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Avg Attendance</span>
                    <span className="text-zinc-100">{attendanceRate.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${getProgressColor(attendanceRate)}`} style={{ width: `${Math.min(attendanceRate, 100)}%` }} />
                  </div>
                </div>

                <div className="mt-4 p-3 bg-zinc-950 rounded border border-zinc-800 text-sm text-zinc-400">
                  💡 {recommendation}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {batches.length === 0 && (
          <p className="text-zinc-500">No batch health data available.</p>
        )}
      </div>
    </div>
  );
}
