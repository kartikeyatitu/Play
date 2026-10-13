"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Batch = {
  name: string;
  sport: string;
  schedule: string;
};

type Enrollment = {
  batch: Batch;
};

type Props = {
  enrollments: Enrollment[];
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeeklyTimetable({ enrollments }: Props) {
  // Parse schedule string like "Mon/Wed/Fri 4:00 PM - 5:30 PM"
  // Return mapping of Day -> Array of { batchName, sport, time }
  const scheduleMap = useMemo(() => {
    const map: Record<string, { batchName: string; sport: string; time: string }[]> = {};
    DAYS.forEach(d => (map[d] = []));

    enrollments.forEach(({ batch }) => {
      if (!batch.schedule) return;

      const [daysPart, ...timeParts] = batch.schedule.split(" ");
      if (!daysPart) return;

      const time = timeParts.join(" ");
      const days = daysPart.split("/");

      days.forEach(day => {
        // match day like Mon, Tue
        const match = DAYS.find(d => d.toLowerCase() === day.toLowerCase() || day.toLowerCase().startsWith(d.toLowerCase()));
        if (match) {
          map[match].push({
            batchName: batch.name,
            sport: batch.sport,
            time,
          });
        }
      });
    });

    return map;
  }, [enrollments]);

  return (
    <Card className="bg-zinc-950 border-zinc-800 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-zinc-100">Weekly Timetable</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[800px] border-t border-zinc-800">
          <div className="grid grid-cols-7 bg-zinc-900/40">
            {DAYS.map(day => (
              <div key={day} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-medium text-zinc-400">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-zinc-800">
            {DAYS.map(day => (
              <div key={day} className="min-h-[120px] p-2 space-y-2">
                {scheduleMap[day].length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-700">
                    —
                  </div>
                ) : (
                  scheduleMap[day].map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-md bg-zinc-900 border border-zinc-800 flex flex-col gap-1"
                    >
                      <div className="text-xs font-semibold text-lime-500 uppercase tracking-wide">
                        {slot.sport}
                      </div>
                      <div className="text-sm font-medium text-zinc-100">
                        {slot.batchName}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {slot.time}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
