"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

type AuditLogWithUser = {
  id: string;
  action: string;
  details: string | null;
  createdAt: Date;
  user: {
    name: string;
    role: string;
  };
};

export function AuditLogViewer({ logs }: { logs: AuditLogWithUser[] }) {
  const getActionIcon = (action: string) => {
    if (action.includes("FEE") || action.includes("PAYMENT")) return "💰";
    if (action.includes("STUDENT") || action.includes("USER")) return "👤";
    if (action.includes("BATCH") || action.includes("CLASS")) return "📅";
    if (action.includes("ANNOUNCEMENT")) return "📢";
    return "⚡";
  };

  const getActionColor = (action: string) => {
    if (action.includes("DELETE") || action.includes("REMOVE")) return "text-rose-400";
    if (action.includes("CREATE") || action.includes("ADD")) return "text-emerald-400";
    if (action.includes("UPDATE") || action.includes("EDIT")) return "text-amber-400";
    return "text-sky-400";
  };

  return (
    <Card className="bg-zinc-900/40 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {logs.length === 0 ? (
            <div className="text-center py-6 text-zinc-500">No activity recorded yet.</div>
          ) : (
            logs.map((log) => {
              let parsedDetails = null;
              try {
                if (log.details) {
                  parsedDetails = JSON.parse(log.details);
                }
              } catch (e) {
                // Ignore parsing errors
              }

              return (
                <div key={log.id} className="relative pl-6">
                  {/* Vertical line */}
                  <div className="absolute left-[11px] top-6 bottom-[-24px] w-px bg-zinc-800 last:hidden" />
                  
                  {/* Dot */}
                  <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-xs">
                    {getActionIcon(log.action)}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="text-sm font-medium text-zinc-200">
                      <span className="font-semibold">{log.user.name}</span>{" "}
                      <span className={`font-mono text-xs ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {parsedDetails && (
                    <div className="mt-2 text-xs text-zinc-400 bg-zinc-950/50 p-2 rounded-md border border-zinc-800/50 font-mono">
                      {Object.entries(parsedDetails).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-zinc-500">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
