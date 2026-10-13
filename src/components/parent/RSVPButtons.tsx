"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateRSVP } from "@/app/actions/events";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function RSVPButtons({ eventId, studentId, currentStatus }: { eventId: string, studentId: string, currentStatus: string }) {
  const [loading, setLoading] = useState(false);

  async function handleRSVP(status: string) {
    setLoading(true);
    await updateRSVP(eventId, studentId, status);
    setLoading(false);
  }

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />;

  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
      <Button 
        size="sm"
        variant="outline"
        onClick={() => handleRSVP("GOING")}
        className={`h-10 sm:h-8 w-full sm:w-auto ${currentStatus === "GOING" ? "bg-lime-500/20 text-lime-400 border-lime-500/50" : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}
      >
        <CheckCircle2 className="w-4 h-4 mr-1" /> Going
      </Button>
      <Button 
        size="sm"
        variant="outline"
        onClick={() => handleRSVP("NOT_GOING")}
        className={`h-10 sm:h-8 w-full sm:w-auto ${currentStatus === "NOT_GOING" ? "bg-rose-500/20 text-rose-400 border-rose-500/50" : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}
      >
        <XCircle className="w-4 h-4 mr-1" /> Can't Go
      </Button>
    </div>
  );
}
