"use client";

import { useState } from "react";
import { UserPlus, MessageCircle, Loader2, Check, PhoneOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createParentInviteLinks, type ParentInvite } from "@/app/actions/coach-invites";

export interface PendingParent {
  studentId: string;
  childName: string;
  parentName: string;
}

export interface InviteParentsCardProps {
  /** Parents who have never opened the app (User.lastSeenAt null), one row per student. */
  pending: PendingParent[];
  academyName: string;
  coachName: string;
}

const brandTint = (pct: number) => `color-mix(in srgb, var(--brand) ${pct}%, transparent)`;

function firstWord(name: string) {
  const parts = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, "").trim().split(/\s+/);
  return parts[0] || name;
}

function inviteMessage(inv: ParentInvite, coachName: string, academyName: string) {
  return `Hi ${firstWord(inv.parentName)}, ${coachName} here from ${academyName}. Track ${inv.childName}'s attendance, progress & fees on Triq: ${inv.url}`;
}

export function InviteParentsCard({ pending, academyName, coachName }: InviteParentsCardProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<ParentInvite[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  if (!pending || pending.length === 0) return null;

  // Unique parents (a parent with two kids counts once)
  const n = new Set(pending.map((p) => p.parentName)).size || pending.length;

  const loadInvites = async () => {
    setLoading(true);
    try {
      const res = await createParentInviteLinks(pending.map((p) => p.studentId));
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setInvites(res.invites);
      if (res.invites.length === 0) toast.info("None of these parents has a phone number on file.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create invite links. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openDialog = () => {
    setOpen(true);
    if (!invites && !loading) void loadInvites();
  };

  const coveredStudentIds = new Set((invites || []).flatMap((i) => i.studentIds));
  const noPhone = invites ? pending.filter((p) => !coveredStudentIds.has(p.studentId)) : [];

  return (
    <>
      <div
        className="rounded-3xl border bg-zinc-900/60 p-4 flex items-center gap-3 min-w-0"
        style={{ borderColor: brandTint(45) }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-[var(--brand)]"
          style={{ backgroundColor: brandTint(14) }}
        >
          <UserPlus className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white leading-tight">Invite parents</p>
          <p className="text-xs text-zinc-400 leading-snug mt-0.5">
            {n} {n === 1 ? "parent hasn't" : "parents haven't"} joined Triq yet
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          className="shrink-0 h-10 px-3.5 rounded-xl bg-[var(--brand)] text-[var(--brand-foreground)] text-sm font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <MessageCircle className="w-4 h-4" />
          Invite
        </button>
      </div>

      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg font-bold text-white">Invite parents on WhatsApp</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Each parent gets a personal one-tap link (valid 7 days) to see attendance, progress and fees.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="py-10 flex flex-col items-center gap-2 text-zinc-400 text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
              Creating invite links…
            </div>
          )}

          {!loading && invites === null && (
            <div className="py-8 flex flex-col items-center gap-3 text-sm text-zinc-400">
              Couldn&apos;t create the links.
              <button
                type="button"
                onClick={() => void loadInvites()}
                className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          )}

          {!loading && invites && (
            <div className="space-y-2 min-w-0">
              {invites.length > 0 && (
                <p className="text-[11px] text-zinc-500">
                  {sent.size}/{invites.length} sent
                </p>
              )}
              <ul className="divide-y divide-zinc-800/80 rounded-2xl border border-zinc-800 bg-zinc-950/40">
                {invites.map((inv) => {
                  const isSent = sent.has(inv.parentId);
                  return (
                    <li key={inv.parentId} className="flex items-center gap-3 p-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-100 truncate">{inv.parentName}</p>
                        <p className="text-[11px] text-zinc-500 truncate">Parent of {inv.childName}</p>
                      </div>
                      <a
                        href={`https://wa.me/${inv.phone}?text=${encodeURIComponent(inviteMessage(inv, coachName, academyName))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSent((prev) => new Set(prev).add(inv.parentId))}
                        className={`shrink-0 h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          isSent
                            ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            : "bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90"
                        }`}
                      >
                        {isSent ? <Check className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                        {isSent ? "Sent" : "Send on WhatsApp"}
                      </a>
                    </li>
                  );
                })}
                {noPhone.map((p) => (
                  <li key={`nophone-${p.studentId}`} className="flex items-center gap-3 p-3 min-w-0 opacity-60">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-300 truncate">{p.parentName}</p>
                      <p className="text-[11px] text-zinc-500 truncate">Parent of {p.childName}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-500 flex items-center gap-1">
                      <PhoneOff className="w-3.5 h-3.5" /> No phone
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
