"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createBatch } from "@/app/actions/batch";
import { Plus } from "lucide-react";

export function CreateBatchDialog({ coaches }: { coaches: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createBatch(formData);
      setIsOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to create batch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="bg-lime-400 text-zinc-950 hover:bg-lime-500 font-bold">
        <Plus className="w-4 h-4 mr-2" />
        Create Batch
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogHeader>
          <DialogTitle>Create New Batch</DialogTitle>
          <DialogDescription>
            Assign a schedule and a coach to a new training batch.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form action={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Batch Name</label>
              <Input name="name" placeholder="e.g. U-14 Football Elite" required className="bg-zinc-900 border-zinc-800" />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Sport</label>
              <Input name="sport" placeholder="e.g. Football, Tennis" required className="bg-zinc-900 border-zinc-800" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Schedule</label>
              <Input name="schedule" placeholder="e.g. Mon/Wed/Fri 4:00 PM" required className="bg-zinc-900 border-zinc-800" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Monthly Fee (₹)</label>
                <Input name="monthlyFee" type="number" min={0} step={1} placeholder="e.g. 2000" className="bg-zinc-900 border-zinc-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Capacity</label>
                <Input name="capacity" type="number" min={0} step={1} placeholder="Optional" className="bg-zinc-900 border-zinc-800" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Coach</label>
              <select 
                name="coachId" 
                defaultValue=""
                className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
              >
                <option value="">Me (I coach this batch)</option>
                {coaches.map(coach => (
                  <option key={coach.id} value={coach.id}>{coach.name}</option>
                ))}
              </select>
            </div>

            <div className="pt-4 flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-lime-400 text-zinc-950 hover:bg-lime-500 font-bold">
                {loading ? "Creating..." : "Save Batch"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
