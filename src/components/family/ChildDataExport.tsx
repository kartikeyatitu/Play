"use client";

import { useState, useTransition } from "react";
import { downloadChildExport, requestChildExport } from "@/app/actions/data-requests";

export interface ExportRequestView {
  referenceId: string;
  status: string;
  createdAt: string;
  canDownload: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  IN_REVIEW: "Being reviewed",
  DONE: "Ready",
  REJECTED: "Declined",
};

/** "Download my child's data": request an export, then download it once the academy approves. */
export function ChildDataExport({ studentId, childName, requests }: { studentId: string; childName: string; requests: ExportRequestView[] }) {
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const open = requests.some((r) => r.status === "REQUESTED" || r.status === "IN_REVIEW");

  const request = () =>
    start(async () => {
      setMsg(null);
      const r = await requestChildExport(studentId);
      setMsg(r.ok ? { tone: "ok", text: `Requested. Reference ${r.referenceId}. You can download it here once the academy approves.` } : { tone: "err", text: r.error });
    });

  const download = (referenceId: string) =>
    start(async () => {
      setMsg(null);
      const r = await downloadChildExport(referenceId);
      if (!r.ok) return setMsg({ tone: "err", text: r.error });
      const url = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.referenceId} className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate text-zinc-300">
            <span className="font-mono text-xs">{r.referenceId}</span> · {STATUS_LABEL[r.status] ?? r.status}
          </span>
          {r.canDownload ? (
            <button type="button" disabled={pending} onClick={() => download(r.referenceId)} className="min-h-11 shrink-0 rounded-lg bg-lime-400 px-3 font-semibold text-zinc-950 disabled:opacity-60">
              Download
            </button>
          ) : null}
        </div>
      ))}
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm ${msg.tone === "err" ? "text-rose-300" : "text-emerald-300"}`}>
          {msg.text}
        </p>
      ) : null}
      {!open ? (
        <button type="button" disabled={pending} onClick={request} className="min-h-12 w-full rounded-lg border border-white/10 text-sm text-zinc-100 hover:bg-white/5 disabled:opacity-60">
          {pending ? "Please wait…" : `Download ${childName}'s data`}
        </button>
      ) : null}
    </div>
  );
}
