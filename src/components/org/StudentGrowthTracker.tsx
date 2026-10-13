"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function StudentGrowthTracker({ data }: { data?: any }) {
  const chartData = data?.monthlyEnrollments || [];
  const churnRate: number | null = data?.churnRate ?? null;
  const netGrowth = data?.netGrowth || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-zinc-100">Academy Growth Tracker</h2>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-500/10">
            Net Growth: {netGrowth}
          </Badge>
          <Badge variant="outline" className="border-rose-500/20 text-rose-400 bg-rose-500/10">
            Churn Rate: {churnRate != null ? `${(churnRate * 100).toFixed(1)}%` : "—"}
          </Badge>
        </div>
      </div>

      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Monthly Enrollments</CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
              <XAxis dataKey="month" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px' }}
                itemStyle={{ color: '#f4f4f5' }}
              />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
