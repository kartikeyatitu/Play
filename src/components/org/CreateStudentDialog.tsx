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
import { createStudent } from "@/app/actions/users";
import { Plus } from "lucide-react";

export function CreateStudentDialog({ batches, orgId }: { batches: any[], orgId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createStudent(formData);
      setIsOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to add student");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="bg-purple-500 text-zinc-950 hover:bg-purple-600 font-bold">
        <Plus className="w-4 h-4 mr-2" />
        Add Student
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Register a new student and their parent contact details.
          </DialogDescription>
        </DialogHeader>
          <form action={onSubmit} className="space-y-4">
            <input type="hidden" name="orgId" value={orgId} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Student Name</label>
                <Input name="studentName" placeholder="Child's Name" required className="bg-zinc-900 border-zinc-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Date of Birth</label>
                <Input name="dob" type="date" required className="bg-zinc-900 border-zinc-800 [color-scheme:dark]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Parent Name</label>
                <Input name="parentName" placeholder="Parent's Name" required className="bg-zinc-900 border-zinc-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Parent Phone</label>
                <Input name="parentPhone" type="tel" placeholder="10-digit number" required className="bg-zinc-900 border-zinc-800" />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Assign to Batch (Optional)</label>
              <select 
                name="batchId" 
                defaultValue=""
                className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
              >
                <option value="">Do not assign yet</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>{batch.name} ({batch.sport})</option>
                ))}
              </select>
            </div>

            <div className="pt-4 flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-zinc-800 hover:bg-zinc-900">Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-purple-500 text-zinc-950 hover:bg-purple-600 font-bold">
                {loading ? "Saving..." : "Save Student"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
