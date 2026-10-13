"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Phone, Ambulance, Search, Loader2, ShieldCheck, HeartPulse } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { reportIncident } from "@/app/actions/incidents";

export interface SOSStudent {
  id: string;
  name: string;
  batchName: string;
  bloodGroup: string | null;
  medical: string | null;
  parentName: string;
  parentPhone: string | null; // digits with country code, or null
}

/**
 * Always-available SOS: pick athlete → call parent / ambulance → checklist → log incident.
 * Rendered as a header button so it is one tap away from every tab.
 */
export function EmergencySOS({ students, coachId }: { students: SOSStudent[]; coachId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checks, setChecks] = useState({ firstAid: false, parent: false, ambulance: false });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = students.find((s) => s.id === selectedId) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
  }, [students, query]);

  function reset() {
    setSelectedId(null);
    setQuery("");
    setNote("");
    setChecks({ firstAid: false, parent: false, ambulance: false });
  }

  async function logIncident() {
    if (!selected) return;
    setSaving(true);
    const steps = [
      checks.firstAid && "first aid given",
      checks.parent && "parent informed",
      checks.ambulance && "ambulance called",
    ].filter(Boolean);
    const description = [note.trim() || "Emergency on field", steps.length ? `Actions: ${steps.join(", ")}` : ""]
      .filter(Boolean)
      .join(". ");
    try {
      await reportIncident(selected.id, coachId, "INJURY", description, checks.ambulance ? "HIGH" : "MEDIUM");
      toast.success("Incident logged · the academy owner can see it");
      reset();
      setOpen(false);
    } catch {
      toast.error("Could not log the incident. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_18px_rgba(225,29,72,0.35)] active:scale-95 transition-all flex items-center gap-1.5"
        aria-label="Emergency SOS"
      >
        <AlertTriangle className="w-3.5 h-3.5" /> SOS
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="bg-zinc-950 border-rose-900/60 text-zinc-100 sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-rose-400 font-black uppercase tracking-wide flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" /> Emergency
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Stay calm. Call for help first, then log what happened.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="tel:112"
              className="h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" /> 112
            </a>
            <a
              href="tel:108"
              className="h-12 rounded-2xl bg-rose-600/80 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2"
            >
              <Ambulance className="w-4 h-4" /> Ambulance 108
            </a>
          </div>

          {!selected ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Which athlete?"
                  className="w-full h-11 rounded-xl bg-zinc-900 border border-zinc-800 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/60"
                />
              </div>
              <ul className="max-h-64 overflow-y-auto divide-y divide-zinc-800/60 rounded-xl border border-zinc-800">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-zinc-900 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{s.name}</div>
                        <div className="text-[11px] text-zinc-500 truncate">
                          {s.batchName}
                          {s.medical ? ` · ${s.medical}` : ""}
                        </div>
                      </div>
                      {s.bloodGroup && (
                        <span className="text-[10px] font-black text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full shrink-0">
                          {s.bloodGroup}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-3 py-6 text-center text-xs text-zinc-500">No athlete found</li>}
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-lg font-black text-white truncate">{selected.name}</div>
                    <div className="text-xs text-zinc-500">{selected.batchName}</div>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} className="text-xs text-zinc-400 hover:text-white">
                    Change
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold">
                    Blood: {selected.bloodGroup || "Unknown"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center gap-1">
                    <HeartPulse className="w-3 h-3 text-rose-400" /> {selected.medical || "No medical notes"}
                  </span>
                </div>
                {selected.parentPhone ? (
                  <a
                    href={`tel:+${selected.parentPhone}`}
                    className="mt-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" /> Call {selected.parentName}
                  </a>
                ) : (
                  <div className="mt-1 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                    No parent phone on file — ask the academy office.
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-2">
                <div className="text-xs font-bold text-zinc-200">Checklist</div>
                {(
                  [
                    ["firstAid", "First aid given"],
                    ["parent", "Parent informed"],
                    ["ambulance", "Ambulance / doctor called"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-rose-600"
                      checked={checks[k]}
                      onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="What happened? (e.g. twisted ankle during sprint drill)"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <button
                type="button"
                onClick={logIncident}
                disabled={saving}
                className="w-full h-11 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-sm flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Log incident
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
