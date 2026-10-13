"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";

interface AnalyticsDashboardProps {
  students: any[];
  batches: any[];
  feeRecords: any[];
  sessions: any[];
}

const COLORS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];

export function AnalyticsDashboard({ students, batches, feeRecords, sessions }: AnalyticsDashboardProps) {
  // === CHART 1: Fee Collection (Pie Chart) ===
  const paid = feeRecords.filter((f: any) => f.status === "PAID").length;
  const pending = feeRecords.filter((f: any) => f.status !== "PAID").length;
  const feeData = [
    { name: "Paid", value: paid },
    { name: "Pending", value: pending },
  ];
  const feeColors = ["#10b981", "#ef4444"];

  // === CHART 2: Students per Batch (Bar Chart) ===
  const batchData = batches.map((b: any) => ({
    name: b.name?.length > 12 ? b.name.slice(0, 12) + "..." : b.name,
    students: b.enrollments?.length || 0,
    capacity: 20,
  }));

  // === CHART 3: Sport Distribution (Pie Chart) ===
  const sportCounts: Record<string, number> = {};
  batches.forEach((b: any) => { sportCounts[b.sport] = (sportCounts[b.sport] || 0) + (b.enrollments?.length || 0); });
  const sportData = Object.entries(sportCounts).map(([name, value]) => ({ name, value }));

  // === CHART 4: Revenue by Month (Area Chart) ===
  // Group fee records by month
  const revenueByMonth: Record<string, number> = {};
  feeRecords.forEach((f: any) => {
    if (f.status === "PAID") {
      const month = f.month || "Unknown";
      revenueByMonth[month] = (revenueByMonth[month] || 0) + (f.amount || 0);
    }
  });
  const revenueData = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({
      month: month.slice(5), // "2026-10" -> "10"
      revenue,
    }));
  // If no data, add placeholder
  if (revenueData.length === 0) {
    revenueData.push({ month: "No data", revenue: 0 });
  }

  // === CHART 5: Attendance Rate per Batch (Bar Chart) ===
  // Calculate attendance rates
  const attendanceByBatch: Record<string, { present: number; total: number }> = {};
  students.forEach((s: any) => {
    const batchName = s.enrollments?.[0]?.batch?.name || "Unknown";
    if (!attendanceByBatch[batchName]) attendanceByBatch[batchName] = { present: 0, total: 0 };
    s.attendances?.forEach((a: any) => {
      attendanceByBatch[batchName].total++;
      if (a.isPresent) attendanceByBatch[batchName].present++;
    });
  });
  const attendanceData = Object.entries(attendanceByBatch).map(([name, data]) => ({
    name: name.length > 12 ? name.slice(0, 12) + "..." : name,
    rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
  }));

  const tooltipStyle = {
    contentStyle: { backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", color: "#e4e4e7" },
    itemStyle: { color: "#e4e4e7" },
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Fee Collection + Sport Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/30 border-zinc-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Fee Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={feeData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {feeData.map((_, i) => <Cell key={i} fill={feeColors[i]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Students by Sport</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sportData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {sportData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Batch Fill Rate */}
      <Card className="bg-zinc-900/30 border-zinc-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">Batch Fill Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={batchData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" domain={[0, 20]} tick={{ fill: "#71717a", fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} width={100} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="students" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Row 3: Revenue Trend + Attendance Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/30 border-zinc-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
                <Tooltip {...tooltipStyle} formatter={(value: any) => [`₹${value.toLocaleString()}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/30 border-zinc-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Attendance Rate by Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 12 }} />
                <Tooltip {...tooltipStyle} formatter={(value: any) => [`${value}%`, "Attendance"]} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} barSize={30}>
                  {attendanceData.map((entry, i) => (
                    <Cell key={i} fill={entry.rate >= 80 ? "#10b981" : entry.rate >= 60 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
