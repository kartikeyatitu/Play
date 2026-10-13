"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { markAttendance } from "@/app/actions/attendance";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  name: string;
}

interface QRScannerProps {
  batchId: string;
  students: Student[];
}

export function QRScanner({ batchId, students }: QRScannerProps) {
  const router = useRouter();
  const [manualInput, setManualInput] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    try {
      let studentId = manualInput.trim();
      if (studentId.startsWith("TRIQ:CHECKIN:")) {
        studentId = studentId.replace("TRIQ:CHECKIN:", "");
      } else if (studentId.startsWith("SPORTSOS:CHECKIN:")) {
        studentId = studentId.replace("SPORTSOS:CHECKIN:", "");
      }

      await markAttendance(batchId, studentId, true);
      const student = students.find((s) => s.id === studentId);
      
      toast.success(`Successfully checked in ${student ? student.name : studentId}!`);
      setStatus({ type: "success", message: `Successfully checked in ${student ? student.name : studentId}!` });
      setManualInput("");
      router.refresh();
      
      setTimeout(() => setStatus({ type: null, message: "" }), 3000);
    } catch (error) {
      console.error(error);
      toast.error("Failed to check in student.");
      setStatus({ type: "error", message: "Failed to check in student." });
    }
  };

  const handleSelectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      await markAttendance(batchId, selectedStudent, true);
      const student = students.find((s) => s.id === selectedStudent);
      
      toast.success(`Successfully checked in ${student?.name}!`);
      setStatus({ type: "success", message: `Successfully checked in ${student?.name}!` });
      setSelectedStudent("");
      router.refresh();
      
      setTimeout(() => setStatus({ type: null, message: "" }), 3000);
    } catch (error) {
      console.error(error);
      toast.error("Failed to check in student.");
      setStatus({ type: "error", message: "Failed to check in student." });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader>
          <CardTitle>Manual Check-in</CardTitle>
          <CardDescription>Scan QR code with external scanner or enter ID manually</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="flex gap-4">
            <Input
              type="text"
              placeholder="Enter Student ID or Scan QR..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 bg-zinc-950 border-zinc-800 focus-visible:ring-lime-500"
              autoFocus
            />
            <Button type="submit" variant="default" className="bg-lime-500 text-zinc-950 hover:bg-lime-600">
              Check In
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader>
          <CardTitle>Select Check-in</CardTitle>
          <CardDescription>Select a student from the dropdown</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSelectSubmit} className="flex gap-4">
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="flex-1 h-10 px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
            >
              <option value="">Select a student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Check In
            </Button>
          </form>
        </CardContent>
      </Card>

      {status.type && (
        <div
          className={`p-4 rounded-md border ${
            status.type === "success"
              ? "bg-emerald-950/30 border-emerald-900 text-emerald-400"
              : "bg-rose-950/30 border-rose-900 text-rose-400"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
