"use client";

import { useState } from "react";
import { reportIncident } from "@/app/actions/incidents";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function IncidentModal({
  studentId,
  coachId,
  studentName,
  trigger,
}: {
  studentId: string;
  coachId: string;
  studentName: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("INJURY");
  const [severity, setSeverity] = useState("LOW");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await reportIncident(studentId, coachId, type, description, severity);
      toast.success("Incident / injury recorded successfully.");
      setOpen(false);
      setDescription("");
      setType("INJURY");
      setSeverity("LOW");
    } catch {
      toast.error("Failed to report incident.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Report Incident / Injury"
          className="w-8 h-8 rounded-xl bg-zinc-850 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>Report Incident / Injury · {studentName}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Incident Category</label>
              <div className="grid grid-cols-3 gap-2">
                {["INJURY", "MISCONDUCT", "OTHER"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      type === t
                        ? "bg-rose-600 text-white border-rose-500 shadow-sm"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Severity Level</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "LOW", label: "Minor" },
                  { id: "MEDIUM", label: "Moderate" },
                  { id: "HIGH", label: "Critical" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSeverity(s.id)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      severity === s.id
                        ? "bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm font-black"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Description & Action Taken</label>
              <textarea
                required
                rows={3}
                placeholder="Details of what happened, ice applied, parent called, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl mt-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Incident Report
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
