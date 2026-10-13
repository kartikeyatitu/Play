"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { submitSkillReport } from "@/app/actions/reports";
import { Loader2, Star, Award } from "lucide-react";
import { toast } from "sonner";

type ExistingReport = { technique: number; fitness: number; discipline: number; notes?: string | null } | null;

export function EvaluateModal({
  student,
  coachId,
  currentMonth,
  trigger,
  existing = null,
}: {
  student: { id: string; name: string };
  coachId: string;
  currentMonth: string;
  trigger?: React.ReactNode;
  existing?: ExistingReport;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [technique, setTechnique] = useState(existing?.technique ?? 3);
  const [fitness, setFitness] = useState(existing?.fitness ?? 3);
  const [discipline, setDiscipline] = useState(existing?.discipline ?? 3);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  function openModal() {
    // Re-sync with the latest server data each time the modal opens
    setTechnique(existing?.technique ?? 3);
    setFitness(existing?.fitness ?? 3);
    setDiscipline(existing?.discipline ?? 3);
    setNotes(existing?.notes ?? "");
    setOpen(true);
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await submitSkillReport(student.id, coachId, currentMonth, technique, fitness, discipline, notes.trim());
      if (res?.success) {
        toast.success(`${existing ? "Updated" : "Saved"} evaluation for ${student.name}`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error((res as { error?: string })?.error || "Failed to submit evaluation.");
      }
    } catch {
      toast.error("Failed to submit evaluation.");
    } finally {
      setLoading(false);
    }
  }

  const renderStars = (value: number, setValue: (v: number) => void) => (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          onClick={() => setValue(star)}
          className="focus:outline-none p-1 hover:scale-110 transition-transform"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= value ? "fill-lime-400 text-lime-400" : "text-zinc-700 hover:text-zinc-500"
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <>
      {trigger ? (
        <span onClick={openModal} className="inline-flex cursor-pointer">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="h-8 px-3 rounded-xl bg-lime-400 hover:bg-lime-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer select-none"
        >
          <Award className="w-3.5 h-3.5" />
          <span>Evaluate</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Evaluate {student.name}</DialogTitle>
            <p className="text-xs text-zinc-400">Monthly Progress Assessment for {currentMonth}</p>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Technique & Execution
              </label>
              {renderStars(technique, setTechnique)}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Fitness & Conditioning
              </label>
              {renderStars(fitness, setFitness)}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Discipline & Game Sense
              </label>
              {renderStars(discipline, setDiscipline)}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Coach notes (visible to parents)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="e.g. Great improvement in footwork. Work on weak-foot passing."
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-11 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-bold rounded-xl mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {existing ? "Update Evaluation" : "Save Evaluation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
