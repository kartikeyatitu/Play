"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface FeePricingAnalyzerProps {
  currentFee?: number;
  totalStudents: number;
  city: string;
}

/** Rough market benchmarks by city. Shown as guidance only; not financial advice. */
const MARKET_DATA: Record<string, { min: number; max: number; avg: number }> = {
  "Gurgaon": { min: 2000, max: 5000, avg: 3200 },
  "Delhi": { min: 1500, max: 4500, avg: 2800 },
  "Mumbai": { min: 2500, max: 6000, avg: 4000 },
  "Bangalore": { min: 2000, max: 5500, avg: 3500 },
  "Dubai": { min: 3000, max: 8000, avg: 5000 },
  "Singapore": { min: 4000, max: 10000, avg: 7000 },
  "London": { min: 4000, max: 12000, avg: 8000 },
  "Default": { min: 1500, max: 4000, avg: 2500 },
};

export function FeePricingAnalyzer({ currentFee = 0, totalStudents, city }: FeePricingAnalyzerProps) {
  const market = MARKET_DATA[city] || MARKET_DATA["Default"];
  // When no fee is configured yet, start the simulator at the market average
  const [testFee, setTestFee] = useState<number>(currentFee > 0 ? currentFee : market.avg);

  let position = "At market";
  let positionVariant: "default" | "lime" | "amber" | "rose" = "default";
  
  if (testFee < market.min) {
    position = "Below market";
    positionVariant = "amber";
  } else if (testFee > market.max) {
    position = "Premium";
    positionVariant = "rose";
  } else if (Math.abs(testFee - market.avg) > 500) {
    if (testFee > market.avg) {
      position = "Above average";
      positionVariant = "lime";
    } else {
      position = "Below average";
      positionVariant = "amber";
    }
  }

  // Revenue simulator logic:
  // Assumes 10% churn for every ₹500 increase above market avg
  let simulatedStudents = totalStudents;
  if (testFee > market.avg) {
    const increaseOverAvg = testFee - market.avg;
    const churnFactor = Math.floor(increaseOverAvg / 500) * 0.10;
    simulatedStudents = Math.max(0, Math.floor(totalStudents * (1 - churnFactor)));
  }

  const projectedRevenue = simulatedStudents * testFee;
  const currentRevenue = totalStudents * currentFee;
  const diff = projectedRevenue - currentRevenue;

  return (
    <Card className="p-6 bg-zinc-900/50 border-zinc-800 text-zinc-100 max-w-2xl">
      <h3 className="text-xl font-medium mb-6">Smart Fee Pricing Analyzer</h3>
      
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          <div className="text-sm text-zinc-400 uppercase tracking-wider font-medium">Indicative range{city ? ` (${city})` : ""}</div>
          <div className="text-[11px] text-zinc-600 -mt-3">Rough estimate, not live market data</div>
          <div>
            <div className="text-sm text-zinc-500 mb-1">Range</div>
            <div className="text-lg">₹{market.min.toLocaleString()} - ₹{market.max.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-zinc-500 mb-1">Average</div>
            <div className="text-xl font-semibold text-sky-400">₹{market.avg.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="space-y-4 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50">
          <div className="text-sm text-zinc-400 uppercase tracking-wider font-medium">Your Position</div>
          <div className="text-3xl font-bold">₹{testFee.toLocaleString()}</div>
          <div>
            <Badge variant={positionVariant}>{position}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-6 pt-6 border-t border-zinc-800">
        <div>
          <label className="flex justify-between text-sm text-zinc-300 mb-4">
            <span>Test New Fee Price</span>
            <span className="font-mono bg-zinc-950 px-2 py-1 rounded text-zinc-300 border border-zinc-800">
              ₹{testFee}
            </span>
          </label>
          <input 
            type="range" 
            min="1000" 
            max="10000" 
            step="100"
            value={testFee}
            onChange={(e) => setTestFee(Number(e.target.value))}
            className="w-full accent-sky-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-2">
            <span>₹1,000</span>
            <span>₹10,000</span>
          </div>
        </div>

        <div className="bg-zinc-950 rounded-lg p-5 border border-zinc-800">
          <h4 className="text-sm font-medium text-zinc-400 mb-4">Revenue Simulator</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Students</div>
              <div className="text-lg font-medium">{simulatedStudents} <span className="text-xs text-zinc-500">/ {totalStudents}</span></div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Projected MRR</div>
              <div className="text-lg font-medium">₹{projectedRevenue.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Impact</div>
              <div className={`text-lg font-medium ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                {diff > 0 ? '+' : ''}₹{diff.toLocaleString()}
              </div>
            </div>
          </div>
          {testFee > market.avg && (
            <p className="text-xs text-zinc-500 mt-4 italic">
              * Assuming 10% churn for every ₹500 increase above city average (₹{market.avg}).
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
