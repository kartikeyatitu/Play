"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBatch } from "@/app/actions/batch";
import { createCoach, createStudent } from "@/app/actions/users";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Play } from "lucide-react";

interface OnboardingWizardProps {
  session: any;
  hasBatches: boolean;
  hasCoaches: boolean;
  hasStudents: boolean;
  coaches?: any[];
  batches?: any[];
}

const selectCls =
  "flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:cursor-not-allowed disabled:opacity-50 text-zinc-100";

/**
 * First-run setup. Order: batch -> students -> (optional) coach.
 * A coach is NOT required: the owner is the default coach of a batch.
 * The card disappears once there is at least one batch and one student.
 */
export function OnboardingWizard({ session, hasBatches, hasCoaches, hasStudents, coaches = [], batches = [] }: OnboardingWizardProps) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<number | null>(!hasBatches ? 1 : !hasStudents ? 2 : null);
  const [isHidden, setIsHidden] = useState(false);
  const [loading, setLoading] = useState(false);

  if ((hasBatches && hasStudents) || isHidden) {
    return null;
  }

  const handleAction = async (action: (formData: FormData) => Promise<unknown>, formData: FormData, nextStep: number | null, done: string) => {
    try {
      setLoading(true);
      await action(formData);
      toast.success(done);
      setActiveStep(nextStep);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to complete step");
    } finally {
      setLoading(false);
    }
  };

  const StepHeader = ({ n, title, done, optional }: { n: number; title: string; done: boolean; optional?: boolean }) => (
    <div className="flex items-center justify-between">
      <span className="text-zinc-300 font-medium">
        Step {n}: {title} {optional && <span className="text-xs text-zinc-500 font-normal">(optional)</span>}
      </span>
      <div className="flex-1 border-t border-dashed border-zinc-800 mx-4"></div>
      {done ? (
        <span className="flex items-center text-emerald-500 text-sm"><CheckCircle2 className="w-4 h-4 mr-1" /> Done</span>
      ) : (
        <Button size="sm" variant={activeStep === n ? "default" : "outline"} onClick={() => setActiveStep(activeStep === n ? null : n)}>
          <Play className="w-3 h-3 mr-1" /> {activeStep === n ? "Close" : "Do it now"}
        </Button>
      )}
    </div>
  );

  return (
    <Card className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-800/30 mb-6">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              Welcome to Triq, {session?.name || "Admin"}! 🎉
            </h2>
            <p className="text-zinc-400 mt-1">Create a batch and add your first student. It takes about a minute.</p>
          </div>
          <Button variant="ghost" className="text-zinc-500 hover:text-zinc-300" onClick={() => setIsHidden(true)}>
            Skip Setup <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Step 1: Batch (coach optional, defaults to the owner) */}
          <div className="border border-zinc-800/50 rounded-lg bg-zinc-950/50 p-4">
            <StepHeader n={1} title="Add a Batch" done={hasBatches} />
            {activeStep === 1 && !hasBatches && (
              <div className="mt-4 p-4 border border-zinc-800 rounded-md bg-zinc-900/40">
                <form action={(fd) => handleAction(createBatch, fd, 2, "Batch created")} className="space-y-3">
                  <Input name="name" placeholder="Batch Name (e.g. U-14 Beginners)" required />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select name="sport" required className={selectCls} defaultValue="">
                      <option value="">Select Sport</option>
                      {["Football", "Cricket", "Badminton", "Tennis", "Basketball", "Swimming", "Martial Arts", "Athletics", "Other"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <Input name="monthlyFee" type="number" min={0} step={1} placeholder="Monthly fee ₹ (e.g. 2000)" />
                  </div>
                  <Input name="schedule" placeholder="Schedule (e.g. Mon/Wed/Fri 5 PM or Daily 6 AM)" required />
                  <select name="coachId" className={selectCls} defaultValue="">
                    <option value="">Coach: Me (I coach this batch)</option>
                    {coaches.map((c: any) => (
                      <option key={c.id} value={c.id}>Coach: {c.name}</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" disabled={loading}>{loading ? "Creating…" : "Create Batch"}</Button>
                </form>
              </div>
            )}
          </div>

          {/* Step 2: Students */}
          <div className="border border-zinc-800/50 rounded-lg bg-zinc-950/50 p-4">
            <StepHeader n={2} title="Add Students" done={hasStudents} />
            {activeStep === 2 && !hasStudents && (
              <div className="mt-4 p-4 border border-zinc-800 rounded-md bg-zinc-900/40">
                {!hasBatches ? (
                  <p className="text-sm text-rose-400">Create a batch first (Step 1).</p>
                ) : (
                  <form action={(fd) => handleAction(createStudent, fd, null, "Student added")} className="space-y-3">
                    <input type="hidden" name="orgId" value={session?.orgId} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input name="studentName" placeholder="Student Name" required />
                      <div className="relative">
                        <label className="text-xs text-zinc-500 absolute -top-2 left-2 bg-zinc-900 px-1">Date of Birth</label>
                        <Input name="dob" type="date" required className="mt-1" />
                      </div>
                      <Input name="parentName" placeholder="Parent Name" required />
                      <Input name="parentPhone" placeholder="Parent Phone" required />
                      <select name="batchId" required className={`col-span-1 sm:col-span-2 ${selectCls}`}>
                        <option value="">Select Batch</option>
                        {batches.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={loading}>{loading ? "Adding…" : "Create Student"}</Button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Coach (optional) */}
          <div className="border border-zinc-800/50 rounded-lg bg-zinc-950/50 p-4">
            <StepHeader n={3} title="Add a Coach" done={hasCoaches} optional />
            {activeStep === 3 && !hasCoaches && (
              <div className="mt-4 p-4 border border-zinc-800 rounded-md bg-zinc-900/40">
                <form action={(fd) => handleAction(createCoach, fd, null, "Coach added")} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input type="hidden" name="orgId" value={session?.orgId} />
                  <Input name="name" placeholder="Coach Name" required className="flex-1" />
                  <Input name="phone" placeholder="Phone Number" required className="flex-1" />
                  <Button type="submit" size="sm" disabled={loading}>Create Coach</Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
