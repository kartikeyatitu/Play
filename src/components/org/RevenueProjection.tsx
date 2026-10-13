"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueProjectionProps {
  paidCount: number;
  totalStudents: number;
  ratePerStudent?: number;
  /** Real amounts (₹) from fee records; when provided they override the rate-based estimate. */
  collectedAmount?: number;
  targetAmount?: number;
}

export function RevenueProjection({
  paidCount,
  totalStudents,
  ratePerStudent = 0,
  collectedAmount,
  targetAmount,
}: RevenueProjectionProps) {
  const projected = targetAmount && targetAmount > 0 ? targetAmount : totalStudents * ratePerStudent;
  const collected = collectedAmount ?? paidCount * ratePerStudent;
  const pending = projected - collected;
  const percentage = projected > 0 ? Math.round((collected / projected) * 100) : 0;

  return (
    <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
      <CardHeader>
        <CardTitle className="text-zinc-100">Revenue Projection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-zinc-400">Collected: ₹{collected.toLocaleString()}</span>
            <span className="text-zinc-400">Target: ₹{projected.toLocaleString()}</span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        {projected === 0 && (
          <p className="text-xs text-amber-400 mb-2">Set batch fees or a default fee in Settings to see projections.</p>
        )}
        <p className="text-sm text-zinc-400">
          If all pending fees collected, you'll hit <span className="text-emerald-400">₹{projected.toLocaleString()}</span> this month
        </p>
      </CardContent>
    </Card>
  );
}
