"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AutoProgressReportProps {
  child: { name: string; points: number };
  attendances: { isPresent: boolean }[];
  report: { technique: number; fitness: number; discipline: number; notes: string } | null;
  month: string;
}

export function AutoProgressReport({ child, attendances, report, month }: AutoProgressReportProps) {
  const [copied, setCopied] = useState(false);

  const attended = attendances.filter(a => a.isPresent).length;
  const total = attendances.length;
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
  
  let summary = `*${child.name}'s Progress Report - ${month}*\n\n`;
  summary += `${child.name} attended ${attended} out of ${total} sessions (${pct}%) this month. `;
  
  if (pct >= 90) summary += 'Excellent consistency! ';
  else if (pct >= 70) summary += 'Good attendance, room for improvement. ';
  else summary += 'Attendance needs attention. ';
  
  if (report) {
    summary += '\n\n';
    const avg = ((report.technique + report.fitness + report.discipline) / 3).toFixed(1);
    summary += `*Overall skill rating:* ${avg}/5\n`;
    if (report.technique >= 4) summary += '- Showing strong technical skills.\n';
    if (report.fitness >= 4) summary += '- Great physical fitness.\n';
    if (report.discipline >= 4) summary += '- Excellent discipline and attitude.\n';
    if (report.notes) summary += `\n*Coach notes:* "${report.notes}"\n`;
  }
  
  summary += `\n*Total points earned:* ${child.points}\n`;
  if (child.points >= 150) summary += '🌟 Star performer!';
  else if (child.points >= 80) summary += '💪 Making good progress!';
  else summary += '📈 Keep it up!';

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summary)}`;

  return (
    <Card className="p-6 bg-zinc-900/50 border-zinc-800/50 max-w-lg">
      <h3 className="text-xl font-medium text-zinc-100 mb-4">Auto Progress Report</h3>
      
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 mb-6">
        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed">
          {summary}
        </pre>
      </div>

      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={handleCopy}
          className="flex-1 bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </Button>
        <Button 
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
          onClick={() => window.open(whatsappUrl, '_blank')}
        >
          Share via WhatsApp
        </Button>
      </div>
    </Card>
  );
}
