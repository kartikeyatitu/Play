"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Download } from "lucide-react";

interface Batch {
  id: string;
  name: string;
  sport?: { name: string } | string;
  schedule?: string | null;
  [key: string]: any;
}

interface CalendarExportProps {
  batches: Batch[];
}

export function CalendarExport({ batches }: CalendarExportProps) {
  function generateICS(batchName: string, schedule: string, sport: string): string {
    const now = new Date();
    const startDate = new Date(now);
    // Format: YYYYMMDDTHHMMSSZ
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Triq//EN
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(new Date(startDate.getTime() + 90 * 60000))}
SUMMARY:${sport} - ${batchName}
DESCRIPTION:Schedule: ${schedule}\\nManaged by Triq
RRULE:FREQ=WEEKLY;COUNT=52
END:VEVENT
END:VCALENDAR`;
  }

  const downloadICS = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBatch = (batch: Batch) => {
    const sportName = typeof batch.sport === 'string' ? batch.sport : batch.sport?.name || 'Sport';
    const schedule = batch.schedule || 'Regular schedule';
    
    const icsContent = generateICS(batch.name, schedule, sportName);
    downloadICS(icsContent, `${batch.name.replace(/\\s+/g, '_')}_schedule.ics`);
  };

  const handleExportAll = () => {
    if (batches.length === 0) return;
    
    let combinedICS = `BEGIN:VCALENDAR\\nVERSION:2.0\\nPRODID:-//Triq//EN`;
    
    const now = new Date();
    const startDate = new Date(now);
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    batches.forEach(batch => {
      const sportName = typeof batch.sport === 'string' ? batch.sport : batch.sport?.name || 'Sport';
      const schedule = batch.schedule || 'Regular schedule';
      
      combinedICS += `\\nBEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(new Date(startDate.getTime() + 90 * 60000))}
SUMMARY:${sportName} - ${batch.name}
DESCRIPTION:Schedule: ${schedule}\\nManaged by Triq
RRULE:FREQ=WEEKLY;COUNT=52
END:VEVENT`;
    });
    
    combinedICS += `\\nEND:VCALENDAR`;
    downloadICS(combinedICS, `all_batches_schedule.ics`);
  };

  return (
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium text-zinc-100 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-zinc-400" />
              Calendar Export
            </CardTitle>
            <CardDescription className="text-zinc-500">Export batch schedules to your calendar</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportAll}
            disabled={batches.length === 0}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900"
          >
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <p className="text-sm text-zinc-500">No batches available to export.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {batches.map(batch => (
              <div key={batch.id} className="flex items-center justify-between p-3 rounded-md bg-zinc-900/40 border border-zinc-800">
                <div>
                  <h4 className="text-sm font-medium text-zinc-200">{batch.name}</h4>
                  <p className="text-xs text-zinc-500">{batch.schedule || 'No schedule set'}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleExportBatch(batch)}
                  className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Add to Calendar
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
