"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listApplications,
  listOpportunitiesAdmin,
  saveOpportunity,
  setApplicationStatus,
  setOpportunityStatus,
} from "@/app/actions/opportunities";
import {
  APPLICATION_STATUS_LABELS,
  OPPORTUNITY_KINDS,
  OPPORTUNITY_KIND_LABELS,
  type ApplicationStatus,
  type OpportunityKind,
} from "@/lib/opportunities";

type ListResult = Awaited<ReturnType<typeof listOpportunitiesAdmin>>;
type Data = Extract<ListResult, { success: true }>;
type Opp = Data["opportunities"][number];
type AppsResult = Awaited<ReturnType<typeof listApplications>>;
type App = Extract<AppsResult, { success: true }>["applications"][number];

const field = "w-full h-10 rounded-lg bg-surface border border-line px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt/30";
const small = "rounded-md border border-line px-2.5 py-1 text-xs text-ink hover:bg-surface disabled:opacity-50";
const day = (v: string | Date | null) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const iso = (v: string | Date | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

const emptyForm = { title: "", kind: "TRIAL", sport: "", location: "", startDate: "", endDate: "", applyBy: "", ageMin: "", ageMax: "", url: "", description: "", batchId: "" };

const NEXT_STEPS: Record<string, ApplicationStatus[]> = {
  APPLIED: ["SHORTLISTED", "NOT_SELECTED"],
  SHORTLISTED: ["SELECTED", "NOT_SELECTED"],
  NOT_SELECTED: ["SHORTLISTED"],
};

export function OpportunitiesPanel() {
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<typeof emptyForm | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [apps, setApps] = React.useState<App[] | null>(null);
  const [pending, start] = React.useTransition();

  const load = React.useCallback(async () => {
    const res = await listOpportunitiesAdmin();
    if (res.success) { setData(res); setError(null); } else setError(res.error);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const loadApps = React.useCallback(async (id: string) => {
    setApps(null);
    const res = await listApplications(id);
    if (res.success) setApps(res.applications); else toast.error(res.error);
  }, []);

  const act = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.success) { toast.success(ok); after?.(); await load(); if (openId) await loadApps(openId); }
      else toast.error(res.error || "Something went wrong");
    });

  if (error) return <p className="text-sm text-ink-muted">{error}</p>;
  if (!data) return <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading opportunities…</div>;

  const edit = (o: Opp) => {
    setEditingId(o.id);
    setForm({
      title: o.title, kind: o.kind, sport: o.sport ?? "", location: o.location ?? "", startDate: iso(o.startDate), endDate: iso(o.endDate),
      applyBy: iso(o.applyBy), ageMin: o.ageMin?.toString() ?? "", ageMax: o.ageMax?.toString() ?? "", url: o.url ?? "", description: o.description ?? "", batchId: o.batchId ?? "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted max-w-xl">
          Share trials, scholarships and camps with your families. Parents apply for their child with consent; you track each application&apos;s status.
        </p>
        {!form && <Button onClick={() => { setForm(emptyForm); setEditingId(null); }}><Plus className="h-4 w-4 mr-1" />New opportunity</Button>}
      </div>

      {form && (
        <form
          className="rounded-xl border border-line p-4 space-y-3"
          onSubmit={(e) => { e.preventDefault(); act(() => saveOpportunity(form, editingId ?? undefined), editingId ? "Saved" : "Saved as draft", () => { setForm(null); setEditingId(null); }); }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <input className={`${field} sm:col-span-2`} required minLength={3} maxLength={120} placeholder="Title, e.g. U-16 state team trials" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Type">
              {OPPORTUNITY_KINDS.map((k) => <option key={k} value={k}>{OPPORTUNITY_KIND_LABELS[k as OpportunityKind]}</option>)}
            </select>
            <input className={field} maxLength={40} placeholder="Sport" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
            <input className={`${field} sm:col-span-2`} maxLength={120} placeholder="Location / organiser" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <label className="text-xs text-ink-muted">Apply by<input className={field} type="date" required value={form.applyBy} onChange={(e) => setForm({ ...form, applyBy: e.target.value })} /></label>
            <label className="text-xs text-ink-muted">Starts<input className={field} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label className="text-xs text-ink-muted">Ends<input className={field} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            <input className={field} inputMode="numeric" placeholder="Min age" value={form.ageMin} onChange={(e) => setForm({ ...form, ageMin: e.target.value })} />
            <input className={field} inputMode="numeric" placeholder="Max age" value={form.ageMax} onChange={(e) => setForm({ ...form, ageMax: e.target.value })} />
            <select className={field} value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} aria-label="Who can see it">
              <option value="">Whole academy</option>
              {data.batches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.sport})</option>)}
            </select>
            <input className={`${field} sm:col-span-3`} type="url" placeholder="Official link (optional)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <textarea className={`${field} h-24 py-2 sm:col-span-3`} maxLength={2000} placeholder="Details: eligibility, what to bring, costs…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{editingId ? "Save" : "Save draft"}</Button>
            <Button type="button" variant="outline" onClick={() => { setForm(null); setEditingId(null); }}>Cancel</Button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {data.opportunities.map((o) => {
          const total = Object.values(o.counts).reduce((s, n) => s + n, 0);
          return (
            <li key={o.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{o.title}</p>
                  <p className="text-xs text-ink-muted">
                    {[OPPORTUNITY_KIND_LABELS[o.kind as OpportunityKind] ?? o.kind, o.sport, o.location, `apply by ${day(o.applyBy)}`,
                      o.ageMin != null || o.ageMax != null ? `ages ${o.ageMin ?? "any"}–${o.ageMax ?? "any"}` : null,
                      o.batchId ? data.batches.find((b) => b.id === o.batchId)?.name : "whole academy"].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${o.status === "OPEN" ? "border-emerald-600 text-emerald-500" : "border-line text-ink-muted"}`}>{o.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {o.status === "DRAFT" && <button className={small} disabled={pending} onClick={() => act(() => setOpportunityStatus(o.id, "OPEN"), "Published to parents")}>Publish</button>}
                {o.status === "OPEN" && <button className={small} disabled={pending} onClick={() => act(() => setOpportunityStatus(o.id, "CLOSED"), "Closed")}>Close</button>}
                {o.status === "CLOSED" && <button className={small} disabled={pending} onClick={() => act(() => setOpportunityStatus(o.id, "OPEN"), "Re-opened")}>Re-open</button>}
                {o.status !== "CLOSED" && <button className={small} disabled={pending} onClick={() => edit(o)}>Edit</button>}
                <button className={small} onClick={() => { const next = openId === o.id ? null : o.id; setOpenId(next); if (next) void loadApps(next); }}>
                  Applications ({total})
                </button>
                {o.url && <a className={small} href={o.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="inline h-3 w-3" /> Link</a>}
              </div>

              {openId === o.id && (
                <div className="mt-3 border-t border-line pt-3">
                  {!apps ? (
                    <p className="text-xs text-ink-muted">Loading…</p>
                  ) : apps.length === 0 ? (
                    <p className="text-xs text-ink-muted">No applications yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {apps.map((a) => (
                        <li key={a.id} className="rounded-lg bg-surface p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-ink">{a.studentName}</span>
                            <span className="text-xs text-ink-muted">{APPLICATION_STATUS_LABELS[a.status as ApplicationStatus] ?? a.status}</span>
                          </div>
                          <p className="text-xs text-ink-muted">
                            {a.batches.join(", ") || "No batch"} · guardian consent {a.guardianConsent ? `given ${day(a.consentAt)}` : "missing"}
                            {!a.dobOnFile && " · date of birth not on file"}
                          </p>
                          {a.note && <p className="mt-1 text-xs text-ink">Parent note: {a.note}</p>}
                          <ol className="mt-1 text-[11px] text-ink-muted">
                            {a.events.map((ev) => (
                              <li key={ev.id}>{day(ev.createdAt)} — {APPLICATION_STATUS_LABELS[ev.toStatus as ApplicationStatus] ?? ev.toStatus}{ev.note ? ` (${ev.note})` : ""}</li>
                            ))}
                          </ol>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(NEXT_STEPS[a.status] ?? []).map((to) => (
                              <button key={to} className={small} disabled={pending} onClick={() => {
                                const note = window.prompt(`Note for "${APPLICATION_STATUS_LABELS[to]}" (optional)`) ?? undefined;
                                act(() => setApplicationStatus(a.id, to, note), `Marked ${APPLICATION_STATUS_LABELS[to].toLowerCase()}`);
                              }}>
                                {APPLICATION_STATUS_LABELS[to]}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {data.opportunities.length === 0 && !form && <li className="text-sm text-ink-muted">No opportunities yet.</li>}
      </ul>
    </div>
  );
}
