"use client";

import { useState, useTransition } from "react";
import { updateLeadStatus, updateLead, convertLeadToStudent } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Flame, 
  Phone, 
  MessageSquare, 
  User, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

type Lead = {
  id: string;
  parentName: string;
  parentPhone: string;
  childName: string;
  childAge: number | null;
  sport: string | null;
  source: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_COLUMNS = [
  { id: "NEW", label: "New Leads", color: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
  { id: "CONTACTED", label: "Contacted", color: "border-purple-500/40 text-purple-400 bg-purple-500/10" },
  { id: "TRIAL_BOOKED", label: "Trial Booked", color: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
  { id: "TRIAL_ATTENDED", label: "Trial Attended", color: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10" },
  { id: "ENROLLED", label: "Enrolled", color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
  { id: "LOST", label: "Lost", color: "border-zinc-700 text-zinc-500 bg-zinc-800/40" },
];

export function LeadPipeline({ 
  initialLeads, 
  stats, 
  batches 
}: { 
  initialLeads: Lead[], 
  stats: any,
  batches: { id: string, name: string }[] 
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [isPending, startTransition] = useTransition();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [enrollBatchId, setEnrollBatchId] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  const handleStatusChange = (leadId: string, newStatus: string) => {
    // Optimistic update
    setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    
    startTransition(async () => {
      const res = await updateLeadStatus(leadId, newStatus);
      if (!res.success) {
        setLeads(initialLeads);
        toast.error("Failed to update status");
      } else {
        toast.success(`Moved to ${newStatus.replace("_", " ")}`);
      }
    });
  };

  const handleConvert = (leadId: string) => {
    if (!enrollBatchId) {
      toast.error("Please select a batch first");
      return;
    }
    startTransition(async () => {
      const res = await convertLeadToStudent(leadId, enrollBatchId);
      if (res.success) {
        setLeads(leads.map(l => l.id === leadId ? { ...l, status: "ENROLLED" } : l));
        setSelectedLead(null);
        toast.success("Lead successfully converted to Student!");
      } else {
        toast.error(res.error || "Failed to convert lead");
      }
    });
  };

  const handleSaveNote = async (leadId: string) => {
    try {
      await updateLead(leadId, { notes: noteDraft });
      setLeads(leads.map(l => l.id === leadId ? { ...l, notes: noteDraft } : l));
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    }
  };

  const getDaysSince = (date: Date) => {
    const days = Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 3600 * 24));
    return days === 0 ? "Today" : `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Analytics KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Inquiries</span>
            <Users className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{leads.length}</span>
            <span className="text-xs text-blue-400 font-medium">pipeline</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Conversion Rate</span>
            <TrendingUp className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400">{stats?.conversionRate || 0}%</span>
            <span className="text-xs text-zinc-500">enrolled</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Avg Turnaround</span>
            <Clock className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{stats?.avgTimeDays || 0}</span>
            <span className="text-xs text-zinc-500">days to close</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Top Source</span>
            <Flame className="w-4 h-4 text-zinc-500 group-hover:text-rose-400 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white capitalize truncate">
              {(stats?.bestSource || "Website").toLowerCase().replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex overflow-x-auto gap-4 pb-6 min-h-[580px]">
        {STATUS_COLUMNS.map(col => {
          const colLeads = leads.filter(l => l.status === col.id);
          return (
            <div 
              key={col.id} 
              className="min-w-[310px] max-w-[310px] flex-shrink-0 flex flex-col bg-zinc-900/40 rounded-2xl border border-zinc-800/80 backdrop-blur-xl overflow-hidden shadow-xl"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-900/80 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.color.split(" ")[0].replace("border-", "bg-")}`} />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-200">{col.label}</h3>
                </div>
                <span className="bg-zinc-800/80 text-zinc-400 text-xs px-2 py-0.5 rounded-full font-mono font-semibold border border-zinc-700/50">
                  {colLeads.length}
                </span>
              </div>
              
              {/* Column Body Cards */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {colLeads.map(lead => (
                  <div 
                    key={lead.id} 
                    className="bg-zinc-950/80 border border-zinc-800/90 hover:border-zinc-700/90 p-4 rounded-xl shadow-md transition-all group relative"
                  >
                    {/* Top Row: Parent Name & Age */}
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-sm text-zinc-100 group-hover:text-blue-300 transition-colors">
                        {lead.parentName}
                      </h4>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                        {getDaysSince(lead.createdAt)}
                      </span>
                    </div>

                    {/* Child & Contact Details */}
                    <div className="text-xs text-zinc-400 space-y-1 mb-3">
                      <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>{lead.childName}</span>
                        {lead.childAge && (
                          <span className="text-zinc-500 text-[11px]">({lead.childAge} yrs)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <a 
                          href={`tel:${lead.parentPhone}`}
                          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                        >
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{lead.parentPhone}</span>
                        </a>
                        <a 
                          href={`https://wa.me/${lead.parentPhone.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(lead.parentName)}%2C%20regarding%20${encodeURIComponent(lead.childName)}%27s%20training%20at%20Spartan%20Academy`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title="Chat on WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Tags: Sport & Source */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Badge variant="outline" className="text-[10px] font-medium border-zinc-800 text-zinc-400 bg-zinc-900">
                        {lead.source.replace("_", " ")}
                      </Badge>
                      {lead.sport && (
                        <Badge variant="outline" className="text-[10px] font-semibold border-blue-500/30 text-blue-400 bg-blue-500/10">
                          {lead.sport}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Bottom Actions: Status Select & Details Dialog */}
                    <div className="flex items-center gap-2 pt-2.5 border-t border-zinc-800/80">
                      <select 
                        aria-label={`Change status for ${lead.childName}`}
                        className="text-[11px] bg-zinc-900/90 border border-zinc-700/80 rounded-lg px-2 py-1.5 w-full text-zinc-300 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        disabled={isPending}
                      >
                        {STATUS_COLUMNS.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      
                      <Dialog>
                        <DialogTrigger 
                          className="inline-flex items-center justify-center rounded-lg text-xs font-semibold border border-zinc-700/80 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 h-7 px-3 transition-colors shrink-0" 
                          onClick={() => {
                            setSelectedLead(lead);
                            setNoteDraft(lead.notes || "");
                          }}
                        >
                          View
                        </DialogTrigger>

                        <DialogContent className="sm:max-w-[480px] bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-2xl p-6 rounded-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-white flex items-center justify-between">
                              <span>Lead Dossier</span>
                              {lead.sport && (
                                <Badge className="border-blue-500/40 text-blue-400 bg-blue-500/10 text-xs">
                                  {lead.sport}
                                </Badge>
                              )}
                            </DialogTitle>
                          </DialogHeader>

                          {selectedLead?.id === lead.id && (
                            <div className="space-y-4 pt-2">
                              {/* Parent & Child Profile Box */}
                              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Parent Contact</p>
                                  <p className="font-bold text-zinc-100 text-sm">{lead.parentName}</p>
                                  <div className="flex items-center gap-2 pt-1">
                                    <a 
                                      href={`https://wa.me/${lead.parentPhone.replace(/\D/g, '')}`} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline font-mono"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      {lead.parentPhone}
                                    </a>
                                  </div>
                                </div>

                                <div className="space-y-1 border-l border-zinc-800 pl-3">
                                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Athlete Details</p>
                                  <p className="font-bold text-zinc-100 text-sm">{lead.childName}</p>
                                  <p className="text-xs text-zinc-400">
                                    {lead.childAge ? `${lead.childAge} years old` : "Age not specified"}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Internal Coach / Admin Notes */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <Label className="text-xs font-semibold text-zinc-300">Admission Notes & Requirements</Label>
                                  <button 
                                    type="button" 
                                    onClick={() => handleSaveNote(lead.id)}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                                  >
                                    Save Note
                                  </button>
                                </div>
                                <textarea 
                                  className="w-full min-h-[90px] p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                                  placeholder="Add notes about skill level, preferred timings, trials, etc..."
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                />
                              </div>

                              {/* Conversion to Student Call-To-Action */}
                              <div className="p-4 bg-gradient-to-br from-emerald-950/40 to-zinc-900 border border-emerald-500/30 rounded-xl space-y-3">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                  <Sparkles className="w-4 h-4" />
                                  <span>Enroll as Official Academy Student</span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                  Assign {lead.childName} to an active batch. This will automatically create student & parent profiles and generate fee ledgers.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  <select 
                                    aria-label="Select batch for enrollment"
                                    className="flex-1 p-2 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 font-medium focus:outline-none"
                                    value={enrollBatchId}
                                    onChange={(e) => setEnrollBatchId(e.target.value)}
                                  >
                                    <option value="">Select target training batch...</option>
                                    {batches.map(b => (
                                      <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                  </select>
                                  <Button 
                                    className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs h-9 px-4 shrink-0" 
                                    onClick={() => handleConvert(lead.id)}
                                    disabled={!enrollBatchId || isPending}
                                  >
                                    {isPending ? "Converting..." : "Confirm & Enroll"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}

                {colLeads.length === 0 && (
                  <div className="text-center py-10 px-4 text-zinc-600 text-xs border border-dashed border-zinc-800/80 rounded-xl bg-zinc-950/30">
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
