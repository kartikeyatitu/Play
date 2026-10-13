"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BatchInfo {
  id: string;
  name: string;
  sport: string;
  enrollments?: any[];
  capacity?: number | null;
}

interface CapacityAlertsProps {
  batches: BatchInfo[];
}

export function CapacityAlerts({ batches }: CapacityAlertsProps) {
  // Only batches with a configured capacity can be "full"
  const alerts = batches
    .filter((batch) => !!batch.capacity && batch.capacity > 0)
    .map((batch) => {
      const count = batch.enrollments?.length || 0;
      const fillPercentage = (count / (batch.capacity as number)) * 100;
      return { ...batch, fillPercentage, count };
    })
    .filter((batch) => batch.fillPercentage >= 75)
    .sort((a, b) => b.fillPercentage - a.fillPercentage);

  if (alerts.length === 0) {
    return (
      <Card className="bg-zinc-950 border-zinc-800">
        <CardContent className="p-4 text-zinc-400 text-sm">
          {batches.some((b) => !!b.capacity)
            ? "All batches have capacity ✓"
            : "Set a capacity on your batches (Batches tab) to get full-batch alerts."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((batch) => {
        let alertColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
        let message = "Getting full";
        let variant: "amber" | "rose" | "outline" = "amber";

        if (batch.fillPercentage >= 100) {
          alertColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
          message = "FULL — open new batch";
          variant = "rose";
        } else if (batch.fillPercentage >= 90) {
          alertColor = "text-orange-400 bg-orange-500/10 border-orange-500/20";
          message = "Almost full";
          variant = "amber";
        }

        return (
          <Card key={batch.id} className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-zinc-100 font-medium">{batch.name}</p>
                <p className="text-zinc-500 text-sm">{batch.sport}</p>
              </div>
              <div className="text-right">
                <Badge variant={variant as any} className={alertColor}>
                  {message}
                </Badge>
                <p className="text-zinc-400 text-xs mt-1">
                  {batch.count} / {batch.capacity} enrolled
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
