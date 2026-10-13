"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AttendanceInsightsProps {
  data?: any[];
}

export function AttendanceInsights({ data = [] }: AttendanceInsightsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-100">Smart Attendance Insights</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((batch: any) => (
          <Card key={batch.batchId} className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">{batch.batchName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm text-zinc-400">
                <span>Total Sessions:</span>
                <span className="text-zinc-100 font-medium">{batch.totalSessions}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-zinc-400">
                <span>Avg Attendance:</span>
                <Badge variant={batch.avgAttendance >= 70 ? 'emerald' : 'amber'}>
                  {batch.avgAttendance}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {data.length === 0 && (
          <p className="text-zinc-500">No attendance data available.</p>
        )}
      </div>
    </div>
  );
}
