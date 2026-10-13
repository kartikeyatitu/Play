"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { transferStudent } from "@/app/actions/transfer";

type Student = {
  id: string;
  name: string;
  enrollments: { batchId: string }[];
};

type Batch = {
  id: string;
  name: string;
};

export function BatchTransfer({ students, batches }: { students: Student[]; batches: Batch[] }) {
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [fromBatchId, setFromBatchId] = useState<string>("");
  const [toBatchId, setToBatchId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const student = students.find((s) => s.id === selectedStudent);
  const enrolledBatchIds = student?.enrollments.map((e) => e.batchId) || [];
  
  const fromBatches = batches.filter((b) => enrolledBatchIds.includes(b.id));
  const toBatches = batches.filter((b) => b.id !== fromBatchId);

  const handleTransfer = async () => {
    if (!selectedStudent || !fromBatchId || !toBatchId) return;

    setIsSubmitting(true);
    setMessage(null);

    const result = await transferStudent(selectedStudent, fromBatchId, toBatchId);
    if (result.success) {
      setMessage({ type: "success", text: "Student transferred successfully!" });
      setSelectedStudent("");
      setFromBatchId("");
      setToBatchId("");
    } else {
      setMessage({ type: "error", text: result.error || "Transfer failed" });
    }

    setIsSubmitting(false);
  };

  const selectClass = "flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Card className="bg-zinc-900/40 border-zinc-800 text-zinc-100 max-w-xl">
      <CardHeader>
        <CardTitle>Batch Transfer</CardTitle>
        <CardDescription className="text-zinc-400">
          Move a student from one batch to another.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className={`p-3 rounded-md text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Select Student</label>
          <select 
            className={selectClass}
            value={selectedStudent} 
            onChange={(e) => {
              setSelectedStudent(e.target.value);
              setFromBatchId("");
              setToBatchId("");
            }}
          >
            <option value="">Choose a student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">From Batch</label>
          <select 
            className={selectClass}
            value={fromBatchId} 
            onChange={(e) => setFromBatchId(e.target.value)}
            disabled={!selectedStudent || fromBatches.length === 0}
          >
            <option value="">Select current batch</option>
            {fromBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">To Batch</label>
          <select 
            className={selectClass}
            value={toBatchId} 
            onChange={(e) => setToBatchId(e.target.value)}
            disabled={!fromBatchId}
          >
            <option value="">Select new batch</option>
            {toBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <Button 
          className="w-full mt-4" 
          onClick={handleTransfer} 
          disabled={!selectedStudent || !fromBatchId || !toBatchId || isSubmitting}
        >
          {isSubmitting ? "Transferring..." : "Complete Transfer"}
        </Button>
      </CardContent>
    </Card>
  );
}
