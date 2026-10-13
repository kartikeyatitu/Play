"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateWaitlistStatus, addToWaitlist } from "@/app/actions/waitlist";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type WaitlistEntry = {
  id: string;
  batchId: string;
  parentName: string;
  parentPhone: string;
  childName: string;
  status: string;
  createdAt: Date;
};

type Batch = {
  id: string;
  name: string;
  sport: string;
};

export function WaitlistManager({ batches, waitlist }: { batches: Batch[]; waitlist: WaitlistEntry[] }) {
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    batchId: "",
    parentName: "",
    parentPhone: "",
    childName: "",
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "WAITING":
        return <Badge variant="amber">WAITING</Badge>;
      case "NOTIFIED":
        return <Badge variant="sky">NOTIFIED</Badge>;
      case "ENROLLED":
        return <Badge variant="emerald">ENROLLED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const selectClass = "flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";

  const handleStatusUpdate = (id: string, newStatus: string) => {
    startTransition(async () => {
      const res = await updateWaitlistStatus(id, newStatus);
      if (res.success) {
        if (newStatus === "ENROLLED") {
          toast.success("Successfully enrolled student!");
        } else {
          toast.success("Status updated");
        }
      } else {
        toast.error("Failed to update status");
      }
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batchId || !formData.parentName || !formData.parentPhone || !formData.childName) return;
    
    setIsSubmitting(true);
    const res = await addToWaitlist(formData.batchId, formData.parentName, formData.parentPhone, formData.childName);
    if (res.success) {
      toast.success("Added to waitlist");
      setFormData({ batchId: "", parentName: "", parentPhone: "", childName: "" });
    } else {
      toast.error("Failed to add to waitlist");
    }
    setIsSubmitting(false);
  };

  const filteredWaitlist = selectedBatch === "all" ? waitlist : waitlist.filter((w) => w.batchId === selectedBatch);

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/40 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle>Add to Waitlist</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm text-zinc-400">Batch</label>
              <select 
                className={selectClass}
                value={formData.batchId} 
                onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
              >
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.sport})</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm text-zinc-400">Child Name</label>
              <Input
                className="bg-zinc-950 border-zinc-800"
                value={formData.childName}
                onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                required
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm text-zinc-400">Parent Name</label>
              <Input
                className="bg-zinc-950 border-zinc-800"
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                required
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm text-zinc-400">Parent Phone</label>
              <Input
                className="bg-zinc-950 border-zinc-800"
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Entry"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/40 border-zinc-800 text-zinc-100">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Waitlist Entries</CardTitle>
          <select 
            className={`${selectClass} w-[200px]`}
            value={selectedBatch} 
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            <option value="all">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                <TableHead className="text-zinc-400">Date Joined</TableHead>
                <TableHead className="text-zinc-400">Child</TableHead>
                <TableHead className="text-zinc-400">Parent Details</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWaitlist.length === 0 ? (
                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                    No waitlist entries found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredWaitlist.map((entry) => (
                  <TableRow key={entry.id} className="border-zinc-800 hover:bg-zinc-900/50">
                    <TableCell>{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.childName}</TableCell>
                    <TableCell>
                      <div>{entry.parentName}</div>
                      <div className="text-xs text-zinc-500">{entry.parentPhone}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <select
                        className={`${selectClass} w-[130px] ml-auto`}
                        value={entry.status}
                        onChange={(e) => handleStatusUpdate(entry.id, e.target.value)}
                      >
                        <option value="WAITING">WAITING</option>
                        <option value="NOTIFIED">NOTIFIED</option>
                        <option value="ENROLLED">ENROLLED</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
