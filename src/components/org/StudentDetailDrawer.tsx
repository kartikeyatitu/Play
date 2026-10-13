"use client";

import React, { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AthleticButton } from "@/components/ui/AthleticButton";
import { StatusChip } from "@/components/ui/StatusChip";
import { updateStudent, deleteStudent } from "@/app/actions/users";
import { toast } from "sonner";
import {
  User,
  Phone,
  Calendar,
  Layers,
  Trash2,
  Edit2,
  ExternalLink,
  MessageCircle,
} from "lucide-react";

export interface StudentDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: any;
  batches: Array<{ id: string; name: string }>;
  currentMonth: string;
}

export function StudentDetailDrawer({
  open,
  onOpenChange,
  student,
  batches,
  currentMonth,
}: StudentDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(student?.name || "");
  const [parentName, setParentName] = useState(student?.parent?.name || "");
  const [parentPhone, setParentPhone] = useState(student?.parent?.phone || "");
  const [batchId, setBatchId] = useState(student?.enrollments?.[0]?.batchId || "");

  if (!student) return null;

  const currentFee = student.feeRecords?.find((f: any) => f.month === currentMonth);
  const feeStatus = currentFee?.status === "PAID" ? "paid" : "due";

  async function handleSave() {
    try {
      setLoading(true);
      await updateStudent(student.id, {
        name,
        parentName,
        parentPhone,
        batchId,
      });
      toast.success("Student updated successfully");
      setIsEditing(false);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update student");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to permanently remove ${student.name}?`)) return;
    try {
      setLoading(true);
      await deleteStudent(student.id);
      toast.success("Student removed");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete student");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => {
        setIsEditing(false);
        onOpenChange(v);
      }}
      title={student.name}
      description={`Enrolled athlete · ID: ${student.id.slice(-6)}`}
    >
      <div className="space-y-6 pb-6">
        {/* Top Athletic Profile Header */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-lime-400/10 border border-lime-400/30 flex items-center justify-center font-heading font-black text-lime-400 text-lg">
              {student.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-heading font-bold text-base text-white">{student.name}</div>
              <div className="text-xs text-zinc-400">
                {student.enrollments?.map((e: any) => e.batch?.name).join(", ") || "No batch"}
              </div>
            </div>
          </div>
          <StatusChip status={feeStatus} label={feeStatus === "paid" ? "Paid" : "Dues Pending"} />
        </div>

        {/* Quick Actions (Call/WhatsApp/Profile) */}
        <div className="grid grid-cols-2 gap-3">
          {student.parent?.phone && (
            <a
              href={`https://wa.me/91${student.parent.phone}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-heading font-bold tracking-wide uppercase"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Parent
            </a>
          )}
          <a
            href={`/student/${student.id}`}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-zinc-700 text-xs font-heading font-bold tracking-wide uppercase"
          >
            <ExternalLink className="w-4 h-4" />
            Full History
          </a>
        </div>

        {/* Edit or Details View */}
        {isEditing ? (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-heading uppercase text-zinc-400">Student Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:border-lime-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-heading uppercase text-zinc-400">Parent Name</label>
              <input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="w-full mt-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:border-lime-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-heading uppercase text-zinc-400">Parent Mobile (10 digits)</label>
              <input
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="w-full mt-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:border-lime-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-heading uppercase text-zinc-400">Assigned Batch</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full mt-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:border-lime-400 focus:outline-none"
              >
                <option value="">No Batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-3">
              <AthleticButton variant="primary" className="flex-1" onClick={handleSave} isLoading={loading}>
                Save Changes
              </AthleticButton>
              <AthleticButton variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </AthleticButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-zinc-800/60 text-xs">
                <span className="text-zinc-400 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  Parent
                </span>
                <span className="font-medium text-white">{student.parent?.name || "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-800/60 text-xs">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-500" />
                  Mobile
                </span>
                <span className="font-medium text-white">{student.parent?.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-800/60 text-xs">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-zinc-500" />
                  Batch
                </span>
                <span className="font-medium text-lime-400">
                  {student.enrollments?.map((e: any) => e.batch?.name).join(", ") || "None"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-800/60 text-xs">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  Joined
                </span>
                <span className="font-medium text-zinc-300">
                  {new Date(student.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <AthleticButton variant="secondary" className="flex-1" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Athlete
              </AthleticButton>
              <AthleticButton variant="destructive" size="icon" onClick={handleDelete} title="Delete student">
                <Trash2 className="w-4 h-4" />
              </AthleticButton>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
