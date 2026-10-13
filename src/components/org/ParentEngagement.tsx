"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ParentEngagement({ data }: { data?: any }) {
  // null = not enough data yet → show "—" instead of an invented number
  const engagementScore: number | null = data?.engagementScore ?? null;
  const messageCount = data?.messageCount || 0;
  const rsvpRate: number | null = data?.rsvpRate ?? null;
  const onTimePaymentRate: number | null = data?.onTimePaymentRate ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-950 border-zinc-800 flex items-center justify-center p-6">
          <div className="text-center">
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Engagement Score</h3>
            <div className="text-4xl font-bold text-emerald-400">{engagementScore ?? "—"}{engagementScore != null && <span className="text-xl text-zinc-500">/100</span>}</div>
          </div>
        </Card>
        
        <Card className="bg-zinc-950 border-zinc-800 flex items-center justify-center p-6">
          <div className="text-center">
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Messages Exchanged</h3>
            <div className="text-4xl font-bold text-zinc-100">{messageCount}</div>
          </div>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800 flex items-center justify-center p-6">
          <div className="text-center">
            <h3 className="text-zinc-400 text-sm font-medium mb-1">Event RSVP Rate</h3>
            <div className="text-4xl font-bold text-sky-400">{rsvpRate != null ? `${(rsvpRate * 100).toFixed(0)}%` : "—"}</div>
          </div>
        </Card>

        <Card className="bg-zinc-950 border-zinc-800 flex items-center justify-center p-6">
          <div className="text-center">
            <h3 className="text-zinc-400 text-sm font-medium mb-1">On-Time Payments</h3>
            <div className="text-4xl font-bold text-amber-400">{onTimePaymentRate != null ? `${(onTimePaymentRate * 100).toFixed(0)}%` : "—"}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
