"use client";

import { Button } from "@/components/ui/button";

interface MonthlyReportProps {
  child: {
    name: string;
    points: number;
  };
  attendances: {
    isPresent: boolean;
  }[];
  report: {
    technique: number;
    fitness: number;
    discipline: number;
    notes: string | null;
  } | null;
  month: string;
  feeStatus: string;
}

export function MonthlyReport({ child, attendances, report, month, feeStatus }: MonthlyReportProps) {
  const total = attendances.length;
  const attended = attendances.filter(a => a.isPresent).length;
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
  
  // Child name, coach notes etc. are user-entered. This HTML is written into a same-origin popup,
  // so unescaped values would run as script with the parent's session.
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const handlePrint = () => {
    const html = `
      <html>
        <head>
          <title>Monthly Report</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; }
            h1 { color: #333; }
            .section { margin-top: 20px; padding: 20px; border: 1px solid #ccc; border-radius: 8px; }
            .stat { margin-bottom: 10px; font-size: 16px; }
            .notes { margin-top: 20px; font-style: italic; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div id="report-content">
            <h1>Triq Monthly Report — ${esc(month)}</h1>
            <div class="section">
              <div class="stat"><strong>Student:</strong> ${esc(child.name)}</div>
              <div class="stat"><strong>Attendance:</strong> ${attended}/${total} sessions (${percentage}%)</div>
              <div class="stat"><strong>Fee Status:</strong> ${esc(feeStatus)}</div>
              <div class="stat"><strong>Points:</strong> ${esc(child.points)}</div>
            </div>
            
            <div class="section">
              <h2>Skill Ratings</h2>
              <div class="stat"><strong>Technique:</strong> ${esc(report?.technique ?? 'N/A')}/5</div>
              <div class="stat"><strong>Fitness:</strong> ${esc(report?.fitness ?? 'N/A')}/5</div>
              <div class="stat"><strong>Discipline:</strong> ${esc(report?.discipline ?? 'N/A')}/5</div>
              
              <div class="notes">
                <strong>Coach Notes:</strong><br/>
                ${esc(report?.notes ?? 'No notes available.')}
              </div>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  return (
    <Button 
      onClick={handlePrint} 
      className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
    >
      Download Report
    </Button>
  );
}
