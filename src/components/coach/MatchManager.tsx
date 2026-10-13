"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEvent } from "@/app/actions/events";
import { Loader2, Trophy } from "lucide-react";

export function CreateMatchModal({ batches }: { batches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState(batches[0]?.id || "");
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [location, setLocation] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await createEvent(batchId, title, new Date(dateStr), location);
      if (res?.success) {
        toast.success("Match scheduled · parents can RSVP now");
        setOpen(false);
        setTitle("");
        setDateStr("");
        setLocation("");
        router.refresh();
      } else {
        toast.error(res?.error || "Could not schedule the match.");
      }
    } catch {
      toast.error("Could not schedule the match.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={batches.length === 0}
        className="h-9 px-3.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
      >
        <Trophy className="w-3.5 h-3.5" /> Schedule match
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Schedule a match</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div className="flex gap-1.5 flex-wrap">
              {batches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBatchId(b.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl border font-semibold ${
                    b.id === batchId
                      ? "bg-lime-400 text-zinc-950 border-lime-400"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <Input required placeholder="Match title (e.g. Friendly vs Tigers)" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <Input required type="datetime-local" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <Input required placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="bg-zinc-900 border-zinc-800" />
            <Button disabled={loading || !batchId} className="w-full bg-lime-400 text-zinc-950 hover:bg-lime-300 font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create match
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RSVPBadge({ rsvps }: { rsvps: { status: string }[] }) {
  const going = rsvps.filter((r) => r.status === "GOING").length;
  const notGoing = rsvps.filter((r) => r.status === "NOT_GOING").length;
  const pending = rsvps.filter((r) => r.status === "PENDING").length;

  return (
    <div className="flex gap-1.5 text-[11px] font-bold">
      <span className="text-lime-400 bg-lime-400/10 border border-lime-400/20 px-2 py-1 rounded-lg">{going} going</span>
      {notGoing > 0 && <span className="text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">{notGoing} out</span>}
      {pending > 0 && <span className="text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg">{pending} pending</span>}
    </div>
  );
}
