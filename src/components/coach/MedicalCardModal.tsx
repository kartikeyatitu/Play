"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HeartPulse, Phone, AlertCircle, Droplet } from "lucide-react";
import { parseMedicalInfo } from "@/lib/coach";

export function MedicalCardModal({
  studentName,
  medicalInfo,
  bloodGroup,
  parentName,
  parentPhone,
  trigger,
}: {
  studentName: string;
  medicalInfo: string | null;
  bloodGroup: string | null;
  parentName: string;
  parentPhone: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

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
          title="Emergency Medical Card"
          className="w-8 h-8 rounded-xl bg-zinc-850 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <HeartPulse className="w-4 h-4" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-white sm:max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-400 uppercase tracking-tight">
              <HeartPulse className="w-5 h-5 text-rose-500" />
              <span>Emergency Medical Card</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                Athlete
              </span>
              <p className="text-xl font-black text-white">{studentName}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Medical Alerts
                </span>
                <p className="text-xs font-medium text-rose-100 leading-relaxed">
                  {parseMedicalInfo(medicalInfo).summary || "No known allergies or medical conditions."}
                </p>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Droplet className="w-3 h-3" /> Blood Group
                </span>
                <p className="text-2xl font-black text-cyan-200 mt-0.5">{bloodGroup || "N/A"}</p>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-2xl">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">
                Primary Emergency Contact
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{parentName}</p>
                  <p className="text-xs text-zinc-400">{parentPhone}</p>
                </div>
                {parentPhone && parentPhone !== "Unknown" && (
                  <a
                    href={`tel:${parentPhone}`}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
