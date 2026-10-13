"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Megaphone, Send, Share2, XCircle, MessageSquareText } from "lucide-react";
import { broadcastToBatch } from "@/app/actions/coach-session";

const TEMPLATES: { label: string; title: string; message: string }[] = [
  { label: "Running late", title: "Coach running 10 min late", message: "Hi parents, I'm running about 10 minutes late today. Please have the kids warm up on arrival. Thanks!" },
  { label: "Bring gear", title: "Reminder: bring your gear", message: "Please make sure your child brings full kit, a water bottle and a towel to the next session." },
  { label: "Great session", title: "Great session today!", message: "Fantastic effort from everyone today — really proud of the energy. Keep practising at home!" },
  { label: "Match day", title: "Match this weekend", message: "We have a match this weekend. Please RSVP in the Triq app so I can plan the squad." },
  { label: "Rain alert", title: "Weather update", message: "Rain is expected. I'll confirm by 2 hours before the session whether we train or not." },
];

export interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  kind: string | null;
  batchName: string;
  createdAt: string; // ISO
}

export function BatchBroadcast({
  batches,
  recent,
}: {
  batches: { id: string; name: string; students: number }[];
  recent: BroadcastItem[];
}) {
  const router = useRouter();
  const [batchId, setBatchId] = useState(batches[0]?.id || "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const batch = batches.find((b) => b.id === batchId);

  async function send() {
    if (!batchId) return;
    setBusy(true);
    try {
      const res = await broadcastToBatch(batchId, title, message);
      if (res.success) {
        toast.success(`Sent to ${batch?.students ?? 0} families in ${batch?.name}`);
        setTitle("");
        setMessage("");
        router.refresh();
      } else toast.error(res.error);
    } catch {
      toast.error("Could not send the message.");
    } finally {
      setBusy(false);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-lime-400" />
          <h2 className="text-base font-bold text-white">Message a batch</h2>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {batches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBatchId(b.id)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors ${
                b.id === batchId
                  ? "bg-lime-400 text-zinc-950 border-lime-400"
                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {b.name} <span className="opacity-60">· {b.students}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                setTitle(t.title);
                setMessage(t.message);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300"
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={120}
          className="w-full h-10 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Message to parents"
          className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={send}
            disabled={busy || !title.trim() || !message.trim() || !batchId}
            className="flex-1 h-10 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send in app
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`*${title}*\n${message}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!message.trim()}
            className={`h-10 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-1.5 ${
              !message.trim() ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <Share2 className="w-4 h-4" /> WhatsApp
          </a>
        </div>
        <p className="text-[11px] text-zinc-500">
          &ldquo;Send in app&rdquo; posts to parents of this batch only. &ldquo;WhatsApp&rdquo; opens WhatsApp so you can paste into your batch group.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Sent recently</h3>
        {recent.length === 0 ? (
          <div className="text-center text-xs text-zinc-500 py-8 rounded-3xl border border-zinc-800/80 bg-zinc-900/30">
            Nothing sent yet. Recaps, cancellations and batch messages will appear here.
          </div>
        ) : (
          recent.map((r) => {
            const Icon = r.kind === "CANCELLATION" ? XCircle : r.kind === "RECAP" ? MessageSquareText : Megaphone;
            const color = r.kind === "CANCELLATION" ? "text-rose-400" : r.kind === "RECAP" ? "text-emerald-400" : "text-lime-400";
            return (
              <div key={r.id} className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-3.5">
                <div className="flex items-start gap-2.5">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white truncate">{r.title}</div>
                      <div className="text-[10px] text-zinc-500 shrink-0">{fmt(r.createdAt)}</div>
                    </div>
                    <div className="text-[11px] text-zinc-500">{r.batchName}</div>
                    <p className="text-xs text-zinc-300 mt-1 whitespace-pre-line line-clamp-3">{r.message}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
