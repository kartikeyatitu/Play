"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function RevenueForecast({ data, feeRate = 0 }: { data?: any; feeRate?: number }) {
  const [addedStudents, setAddedStudents] = useState(0);

  const collected = data?.projectedRevenue - data?.pendingAmount || 0;
  const pending = data?.pendingAmount || 0;
  const collectionRate = data?.collectionRate || 0;
  const forecast = data?.monthlyRevenue || [];

  const simulatedRevenue = addedStudents * feeRate;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-100">Revenue Forecaster</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Current Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-zinc-400">
            <div className="flex justify-between">
              <span>Collected:</span>
              <span className="text-emerald-400 font-medium">₹{collected.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Pending:</span>
              <span className="text-rose-400 font-medium">₹{pending.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Collection Rate:</span>
              <span className="text-zinc-100">{(collectionRate * 100).toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-zinc-100">3-Month Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {forecast.slice(0, 3).map((f: any, i: number) => (
                <div key={i} className="p-4 rounded-lg border border-zinc-800" style={{ backgroundColor: `rgba(16, 185, 129, ${0.1 + i * 0.05})` }}>
                  <div className="text-sm text-zinc-400">{f.month}</div>
                  <div className="text-xl font-bold text-zinc-100">₹{f.revenue.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Growth Simulator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-zinc-400 text-sm">If you add {addedStudents} more students</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={addedStudents} 
                onChange={(e) => setAddedStudents(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-center">
              <div className="text-zinc-100 font-medium mb-1">
                Adding {addedStudents} students = <span className="text-emerald-400">+₹{simulatedRevenue.toLocaleString()}/month</span>
              </div>
              <div className="text-sm text-zinc-400">
                = +₹{(simulatedRevenue * 12).toLocaleString()}/year
              </div>
            </div>
            <div className="space-y-2 pt-4 border-t border-zinc-800 text-sm">
              <div className="text-zinc-400">📈 Peak enrollment: Jun-Jul (summer camps)</div>
              <div className="text-zinc-400">📉 Low season: Feb-Mar (exams)</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">6-Month Projection</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickFormatter={(val) => `₹${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#18181b', stroke: '#10b981', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
