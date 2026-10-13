"use client";

import { useState } from "react";
import Link from "next/link";
import { FeeToggle } from "@/components/org/FeeToggle";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

type Student = {
  id: string;
  name: string;
  parent: {
    name: string;
    phone: string;
  };
  enrollments: {
    batch: {
      name: string;
    };
  }[];
  feeRecords: {
    status: string;
  }[];
  attendances: {
    isPresent: boolean;
  }[];
};

interface StudentTableProps {
  students: Student[];
  currentMonth: string;
}

export function StudentTable({ students, currentMonth }: StudentTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = students.filter((student) => {
    const query = searchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(query) ||
      student.parent.name.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by student or parent name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-md bg-zinc-900/40 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
      />

      {filteredStudents.length === 0 ? (
        <EmptyState
          icon={<Users className="w-12 h-12 text-zinc-600" />}
          title="No students found"
          description={searchQuery ? "Try a different search term" : "No students are enrolled yet"}
        />
      ) : (
        <div className="rounded-md border border-zinc-800 bg-zinc-950">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Name</TableHead>
                <TableHead className="text-zinc-400">Parent / Phone</TableHead>
                <TableHead className="text-zinc-400">Batch</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400 text-right">Fee Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => {
                const isAtRisk =
                  student.attendances.length >= 3 &&
                  student.attendances.slice(-3).every((a) => !a.isPresent);
                
                const feeStatus = student.feeRecords[0]?.status || "PENDING";

                return (
                  <TableRow key={student.id} className="border-zinc-800 hover:bg-zinc-900/40">
                    <TableCell>
                      <Link href={`/student/${student.id}`} className="text-zinc-100 hover:underline">
                        {student.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-zinc-100">
                      <div>{student.parent.name}</div>
                      <div className="text-xs text-zinc-500">{student.parent.phone}</div>
                    </TableCell>
                    <TableCell className="text-zinc-100">
                      {student.enrollments.map((e, i) => (
                        <div key={i}>{e.batch.name}</div>
                      ))}
                    </TableCell>
                    <TableCell>
                      {isAtRisk ? (
                        <Badge variant="rose">At Risk</Badge>
                      ) : (
                        <Badge variant="emerald">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <FeeToggle studentId={student.id} month={currentMonth} initialStatus={feeStatus} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
