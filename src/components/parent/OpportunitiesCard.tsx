"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyToOpportunity, listOpportunitiesForParent, withdrawApplication } from "@/app/actions/opportunities";
import { APPLICATION_STATUS_LABELS, OPPORTUNITY_KIND_LABELS, type ApplicationStatus, type OpportunityKind } from "@/lib/opportunities";

type Result = Awaited<ReturnType<typeof listOpportunitiesForParent>>;
type Opp = Extract<Result, { success: true }>["opportunities"][number];

const day = (v: string | Date | null) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

/** Trials / scholarships shared by the academy; apply per child with explicit guardian consent. */
export function OpportunitiesCard({ academyName }: { academyName?: string | null }) {
  const [opps, setOpps] = React.useState<Opp[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState<{ oppId: string; studentId: string } | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [pending, start] = React.useTransition();

  const load = React.useCallback(async () => {
    const res = await listOpportunitiesForParent();
    if (res.success) setOpps(res.opportunities); else setError(res.error);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  if (error) return null;
  if (!opps || opps.length === 0) return null;

  const submit = () => {
    if (!applying) return;
    start(async () => {
      const res = await applyToOpportunity(applying.oppId, applying.studentId, consent, note);
      if (res.success) { toast.success("Application sent to the academy"); setApplying(null); setConsent(false); setNote(""); await load(); }
      else toast.error(res.error || "Could not apply");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trials &amp; scholarships</CardTitle>
        <p className="text-xs text-zinc-500">Shared by {academyName || "your academy"}. TRIQ does not verify these opportunities.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {opps.map((o) => (
          <div key={o.id} className="rounded-lg border border-zinc-800 p-4">
            <p className="font-semibold text-zinc-100">{o.title}</p>
            <p className="text-xs text-zinc-400">
              {[OPPORTUNITY_KIND_LABELS[o.kind as OpportunityKind] ?? o.kind, o.sport, o.location, o.startDate ? `starts ${day(o.startDate)}` : null, `apply by ${day(o.applyBy)}`,
                o.ageMin != null || o.ageMax != null ? `ages ${o.ageMin ?? "any"}–${o.ageMax ?? "any"}` : null].filter(Boolean).join(" · ")}
            </p>
            {o.description && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{o.description}</p>}
            {o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-sky-400 hover:underline">Official details</a>}

            <ul className="mt-3 space-y-2">
              {o.children.map((c) => (
                <li key={c.studentId} className="rounded-md bg-zinc-900/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-zinc-100">{c.name}</span>
                    {c.application && c.application.status !== "WITHDRAWN" ? (
                      <span className="text-xs text-emerald-400">{APPLICATION_STATUS_LABELS[c.application.status as ApplicationStatus] ?? c.application.status}</span>
                    ) : c.eligible && o.status === "OPEN" ? (
                      <button type="button" className="rounded-md bg-sky-600 px-3 py-1 text-xs text-white hover:bg-sky-500" onClick={() => { setApplying({ oppId: o.id, studentId: c.studentId }); setConsent(false); setNote(""); }}>
                        Apply
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">{c.reason ?? "Closed"}</span>
                    )}
                  </div>
                  {c.application && c.application.history.length > 0 && (
                    <ol className="mt-1 text-[11px] text-zinc-500">
                      {c.application.history.map((h, i) => <li key={i}>{day(h.createdAt)} — {APPLICATION_STATUS_LABELS[h.toStatus as ApplicationStatus] ?? h.toStatus}</li>)}
                    </ol>
                  )}
                  {c.application && (c.application.status === "APPLIED" || c.application.status === "SHORTLISTED") && (
                    <button type="button" disabled={pending} className="mt-1 text-xs text-zinc-400 underline" onClick={() => {
                      if (!window.confirm("Withdraw this application?")) return;
                      start(async () => { const r = await withdrawApplication(c.application!.id); if (r.success) { toast.success("Withdrawn"); await load(); } else toast.error(r.error || "Could not withdraw"); });
                    }}>Withdraw</button>
                  )}
                  {c.ageUnknown && !c.application && <p className="mt-1 text-[11px] text-amber-400">Date of birth not on file — the academy will check age eligibility.</p>}

                  {applying?.oppId === o.id && applying.studentId === c.studentId && (
                    <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                      <textarea className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-zinc-100" rows={2} maxLength={500} placeholder="Note to the academy (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                      <label className="flex items-start gap-2 text-xs text-zinc-300">
                        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                        <span>I am {c.name}&apos;s parent/guardian and consent to {academyName || "the academy"} using {c.name}&apos;s training record (attendance, coach assessments, achievements) for this application. No medical details or contact numbers are shared.</span>
                      </label>
                      <div className="flex gap-2">
                        <button type="button" disabled={!consent || pending} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white disabled:opacity-50" onClick={submit}>Send application</button>
                        <button type="button" className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300" onClick={() => setApplying(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
