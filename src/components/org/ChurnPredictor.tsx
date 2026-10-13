"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface Student {
  id: string;
  name: string;
  attendances: { isPresent: boolean }[];
  feeRecords: { status: string }[];
}

interface ChurnPredictorProps {
  students: Student[];
}

interface AnalyzedStudent {
  student: Student;
  riskScore: number;
  factors: string[];
  action: string;
}

export function ChurnPredictor({ students }: ChurnPredictorProps) {
  const analyzedStudents: AnalyzedStudent[] = students
    .map((student) => {
      let riskScore = 0;
      const factors: string[] = [];

      // Attendance checks
      const last5 = student.attendances.slice(-5);
      const missedInLast5 = last5.filter((a) => !a.isPresent).length;
      
      const last10 = student.attendances.slice(-10);
      const missedInLast10 = last10.filter((a) => !a.isPresent).length;

      if (missedInLast5 === 5 && last5.length === 5) {
        riskScore += 10;
      }
      
      if (missedInLast5 >= 3) {
        riskScore += 30;
        factors.push(`Missed ${missedInLast5} of last 5 sessions`);
      }
      
      if (missedInLast10 >= 5) {
        riskScore += 20;
        factors.push(`Missed ${missedInLast10} of last 10 sessions`);
      }

      // Fee checks
      const currentMonthFee = student.feeRecords[student.feeRecords.length - 1];
      const prevMonthFee = student.feeRecords[student.feeRecords.length - 2];

      if (currentMonthFee?.status === "PENDING") {
        riskScore += 25;
        factors.push("Current month fee unpaid");
      }

      if (currentMonthFee?.status === "PENDING" && prevMonthFee?.status === "PENDING") {
        riskScore += 15;
        factors.push("2 months unpaid");
      }

      riskScore = Math.min(riskScore, 100);

      let action = "Monitor";
      if (riskScore >= 70) action = "Call parent immediately";
      else if (riskScore >= 50) action = "Schedule meeting";
      else if (riskScore > 40) action = "Offer discount/check in";

      return { student, riskScore, factors, action };
    })
    .filter((s) => s.riskScore > 40)
    .sort((a, b) => b.riskScore - a.riskScore);

  if (analyzedStudents.length === 0) {
    return (
      <Card className="p-6 bg-zinc-900/50 border-zinc-800">
        <h3 className="text-xl font-medium text-zinc-100 mb-4">Churn Predictor</h3>
        <p className="text-zinc-400">No high-risk students found.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-zinc-900/50 border-zinc-800">
      <h3 className="text-xl font-medium text-zinc-100 mb-6">High-Risk Students</h3>
      <div className="overflow-x-auto">
        <Table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="py-3 px-4 font-medium">Student Name</th>
              <th className="py-3 px-4 font-medium">Risk Score</th>
              <th className="py-3 px-4 font-medium">Risk Factors</th>
              <th className="py-3 px-4 font-medium">Suggested Action</th>
            </tr>
          </thead>
          <tbody className="text-zinc-100">
            {analyzedStudents.map(({ student, riskScore, factors, action }) => (
              <tr key={student.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                <td className="py-4 px-4 font-medium">{student.name}</td>
                <td className="py-4 px-4 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-right font-medium">{riskScore}%</span>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${riskScore >= 70 ? 'bg-rose-500' : 'bg-amber-500'}`} 
                        style={{ width: `${riskScore}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-wrap gap-2">
                    {factors.map((f, i) => (
                      <Badge key={i} variant={riskScore >= 70 ? 'rose' : 'amber'} className="text-xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-4 text-zinc-400">{action}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
