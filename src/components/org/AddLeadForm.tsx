"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createLead } from "@/app/actions/leads";

const SOURCES = ["WALK_IN", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "PHONE_CALL", "WHATSAPP"];

export function AddLeadForm({ orgId, onSuccess }: { orgId?: string, onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    parentName: "",
    parentPhone: "",
    childName: "",
    childAge: "",
    sport: "",
    source: "WALK_IN",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createLead({
        ...formData,
        childAge: formData.childAge ? parseInt(formData.childAge) : undefined,
        orgId,
      });
      setOpen(false);
      setFormData({
        parentName: "",
        parentPhone: "",
        childName: "",
        childAge: "",
        sport: "",
        source: "WALK_IN",
        notes: "",
      });
      if (onSuccess) onSuccess();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-white text-zinc-900 hover:bg-zinc-200 h-9 px-4 py-2 transition">
        Add New Lead
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parentName">Parent Name</Label>
              <Input
                id="parentName"
                required
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentPhone">Parent Phone</Label>
              <Input
                id="parentPhone"
                required
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="childName">Child Name</Label>
              <Input
                id="childName"
                required
                value={formData.childName}
                onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="childAge">Child Age</Label>
              <Input
                id="childAge"
                type="number"
                value={formData.childAge}
                onChange={(e) => setFormData({ ...formData, childAge: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sport">Sport</Label>
              <Input
                id="sport"
                value={formData.sport}
                onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <select
                id="source"
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              >
                {SOURCES.map(s => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
