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
import { createCoach } from "@/app/actions/users";
import { Plus } from "lucide-react";

export function CreateCoachDialog({ orgId }: { orgId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createCoach(formData);
      setIsOpen(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to add coach");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="bg-cyan-500 text-zinc-950 hover:bg-cyan-600 font-bold">
        <Plus className="w-4 h-4 mr-2" />
        Add Coach
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Coach</DialogTitle>
          <DialogDescription>
            Add a new coach. They can log in using their phone number. Verification documents can be submitted after account creation.
          </DialogDescription>
        </DialogHeader>
          <form action={onSubmit} className="space-y-4">
            <input type="hidden" name="orgId" value={orgId || ""} />
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Coach Name *</label>
              <Input name="name" placeholder="e.g. Rahul Dravid" required className="bg-zinc-900 border-zinc-800" />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Phone Number *</label>
              <Input name="phone" type="tel" placeholder="e.g. 9876543210" required className="bg-zinc-900 border-zinc-800" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Sport / Specialization</label>
              <Input name="sport" placeholder="e.g. Cricket, Football" className="bg-zinc-900 border-zinc-800" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Experience (years)</label>
              <Input name="experience" type="number" placeholder="e.g. 5" className="bg-zinc-900 border-zinc-800" />
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400 font-medium mb-1">📋 Verification Required After Adding</p>
              <ul className="text-xs text-zinc-400 space-y-0.5">
                <li>• Aadhar / PAN (ID Proof)</li>
                <li>• Coaching Certificate</li>
                <li>• Background Check</li>
                <li>• Experience Proof</li>
                <li>• First Aid Certification</li>
              </ul>
              <p className="text-xs text-zinc-500 mt-1">Go to People → Coach Verification after adding.</p>
            </div>

            <div className="pt-4 flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-zinc-800 hover:bg-zinc-900">Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-cyan-500 text-zinc-950 hover:bg-cyan-600 font-bold">
                {loading ? "Saving..." : "Save Coach"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
