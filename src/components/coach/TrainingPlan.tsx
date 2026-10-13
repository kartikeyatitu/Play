"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function TrainingPlan({ batchName }: { batchName: string }) {
  const [plan, setPlan] = useState<string[]>(Array(5).fill(""));
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = `Training Plan - ${batchName}\n\n` + DAYS.map((day, i) => `${day}: ${plan[i] || "Rest"}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updatePlan = (index: number, value: string) => {
    const newPlan = [...plan];
    newPlan[index] = value;
    setPlan(newPlan);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Weekly Training Plan</h2>
          <p className="text-sm text-zinc-500">Batch: {batchName}</p>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 transition"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy for WhatsApp"}
        </button>
      </div>

      <div className="space-y-4">
        {DAYS.map((day, index) => (
          <div key={day} className="flex gap-4 items-start">
            <label className="w-24 pt-2 text-sm font-medium text-zinc-400">
              {day}
            </label>
            <textarea
              value={plan[index]}
              onChange={(e) => updatePlan(index, e.target.value)}
              placeholder={`Enter drills for ${day}...`}
              className="flex-1 min-h-[80px] bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700 resize-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
