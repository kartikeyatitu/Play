"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface PrintViewProps {
  children: React.ReactNode;
  title?: string;
}

export function PrintView({ children, title }: PrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    
    const win = window.open("", "_blank");
    if (!win) return;
    
    win.document.write(`
      <html>
        <head>
          <title>${title || "Triq Report"}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #111; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f5f5f5; font-weight: 600; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            h2 { font-size: 14px; color: #666; margin-bottom: 15px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
            .paid { background: #dcfce7; color: #166534; }
            .pending { background: #fef2f2; color: #991b1b; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Triq</h1>
          <h2>${title || "Report"} — ${new Date().toLocaleDateString('en-IN')}</h2>
          ${content.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={handlePrint} className="border-zinc-700 text-zinc-400 h-8">
          🖨️ Print / PDF
        </Button>
      </div>
      <div ref={printRef}>{children}</div>
    </div>
  );
}
