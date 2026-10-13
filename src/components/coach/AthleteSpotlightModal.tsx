"use client";
import { parseMedicalInfo } from "@/lib/coach";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AvatarRing } from "@/components/ui/avatar-ring";
import { MedicalCardModal } from "@/components/coach/MedicalCardModal";
import { EvaluateModal } from "@/components/coach/EvaluateModal";
import { AddMediaModal } from "@/components/coach/AddMediaModal";
import { CoachActions } from "@/components/coach/CoachActions";
import { IncidentModal } from "@/components/coach/IncidentModal";
import {
  Award,
  HeartPulse,
  Video,
  ShieldAlert,
  Phone,
  MessageCircle,
  AlertTriangle,
  Star,
  CheckCircle2,
  Activity,
  ArrowRight,
} from "lucide-react";

interface AthleteSpotlightProps {
  athlete: {
    id: string;
    name: string;
    batchName: string;
    batchSport: string;
    attendancePct: number;
    medicalInfo: string | null;
    bloodGroup: string | null;
    parent?: {
      name: string;
      phone: string | null;
    } | null;
    skillReport?: {
      technique: number;
      fitness: number;
      discipline: number;
      notes?: string | null;
    } | null;
    attendances?: { isPresent: boolean }[];
  };
  coachId: string;
  currentMonth: string;
  trigger?: React.ReactNode;
}

function cleanIndianPhone(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length > 10) return digits;
  return digits.length > 0 ? digits : null;
}

export function AthleteSpotlightModal({
  athlete,
  coachId,
  currentMonth,
  trigger,
}: AthleteSpotlightProps) {
  const [open, setOpen] = useState(false);

  const parentPhone = cleanIndianPhone(athlete.parent?.phone);
  const parentName = athlete.parent?.name || "Parent";
  const medical = parseMedicalInfo(athlete.medicalInfo);
  const hasMedical = medical.hasAny;

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-8 px-2.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-750 flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
        >
          <span>Manage</span>
          <ArrowRight className="w-3 h-3 text-zinc-500" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800/90 p-5 sm:p-6 text-zinc-100 rounded-3xl space-y-4">
          {/* Header */}
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center gap-3">
              <AvatarRing
                name={athlete.name}
                percentage={athlete.attendancePct}
                size="lg"
                showLabel={false}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold text-white tracking-tight">
                    {athlete.name}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="border-zinc-700 bg-zinc-900 text-zinc-300 text-[10px] capitalize"
                  >
                    {athlete.batchSport}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                  Batch: <span className="text-zinc-200 font-medium">{athlete.batchName}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Athletic Quick Stats Strip */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3 flex flex-col justify-between">
              <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-lime-400" />
                <span>Attendance Rate</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-black text-white">{athlete.attendancePct}%</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    athlete.attendancePct >= 80
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {athlete.attendancePct >= 80 ? "Elite" : "Needs Push"}
                </span>
              </div>
              {athlete.attendances && athlete.attendances.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[10px] text-zinc-500 mr-1">Recent:</span>
                  {athlete.attendances.slice(0, 5).map((att, i) => (
                    <span
                      key={i}
                      title={att.isPresent ? "Present" : "Absent"}
                      className={`w-2 h-2 rounded-full ${
                        att.isPresent ? "bg-emerald-400" : "bg-rose-500"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3 flex flex-col justify-between">
              <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>Skill Review</span>
              </div>
              <div className="mt-1.5">
                {athlete.skillReport ? (
                  <div>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed this Month
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                      <span>Tech: {athlete.skillReport.technique}★</span>
                      <span>Fit: {athlete.skillReport.fitness}★</span>
                      <span>Disc: {athlete.skillReport.discipline}★</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold text-amber-400">Review Pending</span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Monthly assessment due</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Medical & Safety Profile (If applicable) */}
          {hasMedical && (() => {
            const isAlert = medical.severity === "alert";
            return (
              <div className={`${isAlert ? "bg-rose-500/10 border-rose-500/25" : "bg-zinc-800/40 border-zinc-700/60"} border rounded-2xl p-3.5 space-y-1.5`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1.5 font-bold text-xs ${isAlert ? "text-rose-300" : "text-zinc-300"}`}>
                    <AlertTriangle className={`w-3.5 h-3.5 ${isAlert ? "text-rose-400" : "text-zinc-500"}`} />
                    <span>{isAlert ? "Medical alert" : "Medical note"}</span>
                  </div>
                  {athlete.bloodGroup && (
                    <span className="text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full font-bold">
                      Blood: {athlete.bloodGroup}
                    </span>
                  )}
                </div>
                <p className={`text-xs ${isAlert ? "text-rose-200/90" : "text-zinc-400"}`}>{medical.summary || "Condition specified."}</p>
              </div>
            );
          })()}

          {/* Parent Contacts */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                Parent Contact
              </div>
              <div className="text-xs font-bold text-zinc-200 truncate mt-0.5">{parentName}</div>
              <div className="text-xs text-zinc-400">{athlete.parent?.phone || "No phone listed"}</div>
            </div>
            {parentPhone && (
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`tel:+${parentPhone}`}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 flex items-center gap-1.5 text-xs font-medium transition-colors"
                >
                  <Phone className="w-3 h-3 text-emerald-400" />
                  <span>Call</span>
                </a>
                <a
                  href={`https://wa.me/${parentPhone}?text=Hi%20${encodeURIComponent(
                    parentName
                  )},%20regarding%20${encodeURIComponent(athlete.name)}'s%20training%20at%20the%20academy:`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 text-xs font-bold transition-colors"
                >
                  <MessageCircle className="w-3 h-3 text-emerald-400" />
                  <span>WhatsApp</span>
                </a>
              </div>
            )}
          </div>

          {/* Action Suite */}
          <div className="space-y-2 pt-1 border-t border-zinc-850">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Coach Actions
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EvaluateModal
                student={{ id: athlete.id, name: athlete.name }}
                existing={athlete.skillReport ?? null}
                coachId={coachId}
                currentMonth={currentMonth}
              />
              <CoachActions
                studentId={athlete.id}
                className="[&>button]:w-full [&>button]:h-8 [&>button]:justify-center"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <AddMediaModal
                studentId={athlete.id}
                coachId={coachId}
                studentName={athlete.name}
              />
              <IncidentModal
                studentId={athlete.id}
                coachId={coachId}
                studentName={athlete.name}
              />
              <MedicalCardModal
                studentName={athlete.name}
                medicalInfo={athlete.medicalInfo}
                bloodGroup={athlete.bloodGroup}
                parentName={parentName}
                parentPhone={athlete.parent?.phone || "Unknown"}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
