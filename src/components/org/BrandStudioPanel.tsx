"use client";
// TRIQ Brand Studio (V9) admin screen: sponsors, campaigns → proposals → deliverables (FEATURES.sponsorship)
// and scholarship / CSR programs with fee concessions (FEATURES.inclusive). Real rows only.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEATURES } from "@/lib/features";
import {
  APPLICANT_TYPES,
  CAMPAIGN_SCOPES,
  CAMPAIGN_TRANSITIONS,
  DELIVERABLE_TRANSITIONS,
  SPONSOR_KINDS,
  STATUS_LABELS,
  deliverableProgress,
  isCampaignStatus,
  isDeliverableStatus,
  remainingBudgetPaise,
} from "@/lib/brand-studio";
import { CATEGORY_LABELS, CONCESSION_CATEGORIES, PROGRAM_KINDS, describeConcession } from "@/lib/concessions";
import {
  acceptProposal,
  addDeliverable,
  getStatusHistory,
  listBrandStudio,
  saveCampaign,
  saveSponsorProfile,
  setCampaignStatus,
  setDeliverableStatus,
  setProposalStatus,
  setSponsorArchived,
  submitProposal,
} from "@/app/actions/brand-studio";
import { grantConcession, listScholarships, revokeConcession, saveScholarshipProgram, setProgramStatus } from "@/app/actions/concessions";
import { Loader2 } from "lucide-react";

type Studio = NonNullable<Awaited<ReturnType<typeof listBrandStudio>>["data"]>;
type Scholar = NonNullable<Awaited<ReturnType<typeof listScholarships>>["data"]>;

const rupees = (paise: number | null | undefined) => `₹${((paise ?? 0) / 100).toLocaleString("en-IN")}`;
const label = (s: string) => STATUS_LABELS[s] ?? s.replace(/_/g, " ").toLowerCase();
const pretty = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const field = "w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100";

async function run(p: Promise<{ success: boolean; error?: string }>, ok: string) {
  const r = await p;
  if (r.success) toast.success(ok);
  else toast.error(r.error ?? "Something went wrong");
  return r.success;
}

function History({ entityType, entityId }: { entityType: "CAMPAIGN" | "PROPOSAL" | "DELIVERABLE" | "PROGRAM"; entityId: string }) {
  const [events, setEvents] = useState<Array<{ id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: Date }> | null>(null);
  return (
    <details
      className="text-xs text-zinc-500"
      onToggle={async (e) => {
        if ((e.target as HTMLDetailsElement).open && !events) {
          const r = await getStatusHistory(entityType, entityId);
          setEvents(r.success ? r.events : []);
        }
      }}
    >
      <summary className="cursor-pointer">History</summary>
      {!events ? (
        <p>Loading…</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {events.map((ev) => (
            <li key={ev.id}>
              {new Date(ev.createdAt).toLocaleString("en-IN")} — {ev.fromStatus ? `${label(ev.fromStatus)} → ` : ""}
              {label(ev.toStatus)}
              {ev.note ? `: ${ev.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

// ── Sponsors ───────────────────────────────────────────────────────────────────

function SponsorsSection({ data, reload }: { data: Studio; reload: () => void }) {
  const empty = { name: "", kind: "BRAND", contactName: "", contactEmail: "", contactPhone: "", website: "", about: "" };
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await run(saveSponsorProfile({ ...form, ...(editId ? { id: editId } : {}) }), editId ? "Sponsor updated" : "Sponsor added");
    setBusy(false);
    if (ok) {
      setForm(empty);
      setEditId(null);
      reload();
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">{editId ? "Edit sponsor" : "Add sponsor"}</CardTitle>
          <CardDescription>Brands, local businesses and CSR partners your academy works with.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input required maxLength={120} placeholder="Sponsor name" value={form.name} onChange={set("name")} className="bg-zinc-900 border-zinc-800" />
            <select aria-label="Sponsor type" value={form.kind} onChange={set("kind")} className={field}>
              {SPONSOR_KINDS.map((k) => <option key={k} value={k}>{pretty(k)}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Contact person" value={form.contactName} onChange={set("contactName")} className="bg-zinc-900 border-zinc-800" />
              <Input placeholder="Phone" value={form.contactPhone} onChange={set("contactPhone")} className="bg-zinc-900 border-zinc-800" />
              <Input type="email" placeholder="Email" value={form.contactEmail} onChange={set("contactEmail")} className="bg-zinc-900 border-zinc-800" />
              <Input placeholder="Website (https://…)" value={form.website} onChange={set("website")} className="bg-zinc-900 border-zinc-800" />
            </div>
            <textarea maxLength={1000} placeholder="About" value={form.about} onChange={set("about")} className={field} rows={3} />
            <div className="flex gap-2">
              <Button disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editId ? "Save" : "Add sponsor"}</Button>
              {editId && <Button type="button" variant="ghost" onClick={() => { setEditId(null); setForm(empty); }}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="bg-zinc-900/40 border-zinc-800">
        <CardHeader><CardTitle className="text-lg">Sponsors</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.sponsors.length === 0 && <p className="text-sm text-zinc-500">No sponsors yet.</p>}
          {data.sponsors.map((s) => (
            <div key={s.id} className={`p-3 rounded-md border border-zinc-800 bg-zinc-900 ${s.archivedAt ? "opacity-60" : ""}`}>
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100 truncate">{s.name}</p>
                  <p className="text-xs text-zinc-500">
                    {pretty(s.kind)}
                    {s.contactName ? ` · ${s.contactName}` : ""}
                    {s.contactPhone ? ` · ${s.contactPhone}` : ""}
                    {s.archivedAt ? " · archived" : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => {
                    setEditId(s.id);
                    setForm({ name: s.name, kind: s.kind, contactName: s.contactName ?? "", contactEmail: s.contactEmail ?? "", contactPhone: s.contactPhone ?? "", website: s.website ?? "", about: s.about ?? "" });
                  }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (await run(setSponsorArchived(s.id, !s.archivedAt), s.archivedAt ? "Restored" : "Archived")) reload(); }}>
                    {s.archivedAt ? "Restore" : "Archive"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Campaigns ──────────────────────────────────────────────────────────────────

function CampaignForm({ data, reload }: { data: Studio; reload: () => void }) {
  const empty = { title: "", scope: "TEAM", sponsorId: "", objective: "", targetAudience: "", budget: "", deliverablesSummary: "", startDate: "", endDate: "" };
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await run(saveCampaign(form), "Campaign created as draft");
        setBusy(false);
        if (ok) { setForm(empty); reload(); }
      }}
    >
      <Input required maxLength={120} placeholder="Campaign title (e.g. U-14 jersey partner)" value={form.title} onChange={set("title")} className="bg-zinc-900 border-zinc-800" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select aria-label="Who it sponsors" value={form.scope} onChange={set("scope")} className={field}>
          {CAMPAIGN_SCOPES.map((s) => <option key={s} value={s}>{pretty(s)} sponsorship</option>)}
        </select>
        <select aria-label="Sponsor" value={form.sponsorId} onChange={set("sponsorId")} className={field}>
          <option value="">No sponsor yet</option>
          {data.sponsors.filter((s) => !s.archivedAt).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <textarea required maxLength={1000} placeholder="Objective — what the sponsor wants to achieve" value={form.objective} onChange={set("objective")} className={field} rows={2} />
      <Input maxLength={300} placeholder="Target audience (e.g. parents of U-14 players in Noida)" value={form.targetAudience} onChange={set("targetAudience")} className="bg-zinc-900 border-zinc-800" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input required type="number" min="0" step="1" placeholder="Budget (₹)" value={form.budget} onChange={set("budget")} className="bg-zinc-900 border-zinc-800" />
        <Input type="date" aria-label="Start date" value={form.startDate} onChange={set("startDate")} className="bg-zinc-900 border-zinc-800" />
        <Input type="date" aria-label="End date" value={form.endDate} onChange={set("endDate")} className="bg-zinc-900 border-zinc-800" />
      </div>
      <textarea maxLength={1000} placeholder="Expected deliverables (logo on jersey, banner, 2 posts/month…)" value={form.deliverablesSummary} onChange={set("deliverablesSummary")} className={field} rows={2} />
      <p className="text-[11px] text-zinc-500">The budget is locked once the campaign is opened.</p>
      <Button disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Create campaign</Button>
    </form>
  );
}

function ProposalForm({ campaignId, students, reload }: { campaignId: string; students: Studio["students"]; reload: () => void }) {
  const empty = { applicantType: "TEAM", applicantName: "", studentId: "", pitch: "", ask: "" };
  const [form, setForm] = useState<Record<string, string>>(empty);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="space-y-2 p-3 rounded-md border border-dashed border-zinc-700"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(submitProposal({ ...form, campaignId }), "Proposal submitted")) { setForm(empty); reload(); }
      }}
    >
      <p className="text-xs font-semibold text-zinc-400">Submit a proposal</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select aria-label="Applicant type" value={form.applicantType} onChange={set("applicantType")} className={field}>
          {APPLICANT_TYPES.map((t) => <option key={t} value={t}>{pretty(t)}</option>)}
        </select>
        <Input required maxLength={120} placeholder="Applicant name" value={form.applicantName} onChange={set("applicantName")} className="bg-zinc-900 border-zinc-800" />
        <Input required type="number" min="0" step="1" placeholder="Ask (₹)" value={form.ask} onChange={set("ask")} className="bg-zinc-900 border-zinc-800" />
      </div>
      {form.applicantType === "ATHLETE" && (
        <select aria-label="Athlete (staff only)" value={form.studentId} onChange={set("studentId")} className={field}>
          <option value="">Link an athlete from your academy (optional, staff-only)</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <textarea required maxLength={2000} placeholder="Pitch — what you offer the sponsor" value={form.pitch} onChange={set("pitch")} className={field} rows={2} />
      <Button size="sm">Submit</Button>
    </form>
  );
}

function Deliverables({ proposal, reload }: { proposal: Studio["campaigns"][number]["proposals"][number]; reload: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("DELIVERABLE");
  const [due, setDue] = useState("");
  const progress = deliverableProgress(proposal.deliverables.map((d) => d.status));
  return (
    <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
      <p className="text-xs text-zinc-400">
        Deliverables & milestones: {progress.done}/{progress.total} done, {progress.verified} verified{progress.missed ? `, ${progress.missed} missed` : ""}
      </p>
      {proposal.deliverables.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-zinc-950 rounded px-2 py-1.5">
          <div className="min-w-0">
            <span className="text-zinc-200">{d.kind === "MILESTONE" ? "◆ " : "• "}{d.title}</span>
            <span className="text-xs text-zinc-500">
              {d.dueDate ? ` · due ${new Date(d.dueDate).toLocaleDateString("en-IN")}` : ""} · {label(d.status)}
              {d.evidenceUrl ? (<> · <a className="underline" href={d.evidenceUrl} target="_blank" rel="noopener noreferrer">evidence</a></>) : null}
            </span>
          </div>
          <div className="flex gap-1">
            {(isDeliverableStatus(d.status) ? DELIVERABLE_TRANSITIONS[d.status] : []).map((to) => (
              <Button key={to} size="sm" variant="ghost" onClick={async () => {
                const evidenceUrl = to === "DELIVERED" || to === "VERIFIED" ? window.prompt("Evidence link (optional, https://…)") ?? undefined : undefined;
                if (await run(setDeliverableStatus(d.id, to, { evidenceUrl }), `Marked ${label(to)}`)) reload();
              }}>{label(to)}</Button>
            ))}
          </div>
        </div>
      ))}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(addDeliverable({ proposalId: proposal.id, title, kind, dueDate: due }), "Added")) { setTitle(""); setDue(""); reload(); }
        }}
      >
        <Input required maxLength={200} placeholder="Add deliverable or milestone" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-zinc-900 border-zinc-800 flex-1 min-w-[10rem]" />
        <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-md px-2 text-sm">
          <option value="DELIVERABLE">Deliverable</option>
          <option value="MILESTONE">Milestone</option>
        </select>
        <Input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} className="bg-zinc-900 border-zinc-800 w-auto" />
        <Button size="sm">Add</Button>
      </form>
    </div>
  );
}

function CampaignsSection({ data, reload }: { data: Studio; reload: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);

  async function accept(p: Studio["campaigns"][number]["proposals"][number], remaining: number) {
    const amount = window.prompt(`Approve how much (₹)? Remaining budget: ${rupees(remaining)}`, String(Math.min(p.askPaise, remaining) / 100));
    if (amount == null) return;
    const confirm = window.prompt(`This commits ${"₹" + Number(amount).toLocaleString("en-IN")} of the sponsor budget to "${p.applicantName}". Re-type the amount to confirm.`);
    if (confirm == null) return;
    const decisionNote = window.prompt("Decision note (optional)") ?? undefined;
    if (await run(acceptProposal(p.id, amount, confirm, decisionNote), "Proposal accepted")) reload();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
      <Card className="bg-zinc-900/40 border-zinc-800 h-fit">
        <CardHeader>
          <CardTitle className="text-lg">New campaign</CardTitle>
          <CardDescription>Sponsorship opportunity with objectives, budget and deliverables.</CardDescription>
        </CardHeader>
        <CardContent><CampaignForm data={data} reload={reload} /></CardContent>
      </Card>
      <div className="space-y-3">
        {data.campaigns.length === 0 && <p className="text-sm text-zinc-500">No campaigns yet.</p>}
        {data.campaigns.map((c) => {
          const remaining = remainingBudgetPaise(c.budgetPaise, c.committedPaise);
          const open = openId === c.id;
          return (
            <Card key={c.id} className="bg-zinc-900/40 border-zinc-800">
              <CardContent className="p-4 space-y-3">
                <button className="w-full text-left" onClick={() => setOpenId(open ? null : c.id)} aria-expanded={open}>
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-100 truncate">{c.title}</p>
                      <p className="text-xs text-zinc-500">
                        {pretty(c.scope)} · {c.sponsor?.name ?? "no sponsor"} · {c.proposals.length} proposal{c.proposals.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-zinc-200">{rupees(c.committedPaise)} / {rupees(c.budgetPaise)}</p>
                      <p className="text-xs text-zinc-400">{label(c.status)}</p>
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap">{c.objective}</p>
                    {c.targetAudience && <p className="text-xs text-zinc-500">Audience: {c.targetAudience}</p>}
                    {c.deliverablesSummary && <p className="text-xs text-zinc-500">Deliverables: {c.deliverablesSummary}</p>}
                    <div className="flex flex-wrap gap-2">
                      {(isCampaignStatus(c.status) ? CAMPAIGN_TRANSITIONS[c.status] : []).map((to) => (
                        <Button key={to} size="sm" variant={to === "CANCELLED" ? "outline" : "default"} onClick={async () => {
                          if (to === "CANCELLED" && !window.confirm("Cancel this campaign?")) return;
                          if (await run(setCampaignStatus(c.id, to), `Campaign ${label(to).toLowerCase()}`)) reload();
                        }}>
                          {to === "OPEN" ? (c.status === "DRAFT" ? "Open for proposals" : "Re-open") : label(to)}
                        </Button>
                      ))}
                    </div>
                    <History entityType="CAMPAIGN" entityId={c.id} />
                    {c.status === "OPEN" && <ProposalForm campaignId={c.id} students={data.students} reload={reload} />}
                    {c.proposals.map((p) => (
                      <div key={p.id} className="p-3 rounded-md border border-zinc-800 bg-zinc-900 space-y-2">
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-100">{p.applicantName} <span className="text-xs text-zinc-500">({pretty(p.applicantType)})</span></p>
                            <p className="text-xs text-zinc-400 whitespace-pre-wrap">{p.pitch}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm text-zinc-200">Ask {rupees(p.askPaise)}</p>
                            {p.approvedPaise != null && <p className="text-xs text-lime-400">Approved {rupees(p.approvedPaise)}</p>}
                            <p className="text-xs text-zinc-400">{label(p.status)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {p.status === "SUBMITTED" && (
                            <Button size="sm" onClick={async () => { if (await run(setProposalStatus(p.id, "UNDER_REVIEW"), "Moved to review")) reload(); }}>Start review</Button>
                          )}
                          {p.status === "UNDER_REVIEW" && (
                            data.canApprove ? (
                              <Button size="sm" onClick={() => accept(p, remaining)}>Accept…</Button>
                            ) : (
                              <span className="text-xs text-zinc-500 self-center">Accepting needs “Approve sponsorship money” permission</span>
                            )
                          )}
                          {(p.status === "SUBMITTED" || p.status === "UNDER_REVIEW") && (
                            <>
                              <Button size="sm" variant="outline" onClick={async () => {
                                const n = window.prompt("Reason for rejecting (optional)");
                                if (n === null) return;
                                if (await run(setProposalStatus(p.id, "REJECTED", n), "Proposal rejected")) reload();
                              }}>Reject</Button>
                              <Button size="sm" variant="ghost" onClick={async () => { if (await run(setProposalStatus(p.id, "WITHDRAWN"), "Withdrawn")) reload(); }}>Withdraw</Button>
                            </>
                          )}
                        </div>
                        {p.decisionNote && <p className="text-xs text-zinc-500">Decision note: {p.decisionNote}</p>}
                        <History entityType="PROPOSAL" entityId={p.id} />
                        {p.status === "ACCEPTED" && <Deliverables proposal={p} reload={reload} />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Scholarships & concessions ─────────────────────────────────────────────────

function ScholarshipsSection() {
  const [data, setData] = useState<Scholar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await listScholarships();
    if (r.success && r.data) { setData(r.data); setError(null); } else setError(r.error ?? "Could not load");
  }, []);
  useEffect(() => { load(); }, [load]);

  const [prog, setProg] = useState({ name: "", kind: "SCHOLARSHIP", description: "", monthlyBudget: "", sponsorId: "" });
  const [conc, setConc] = useState({ studentId: "", programId: "", category: "SCHOLARSHIP", mode: "FULL", value: "", startMonth: "", endMonth: "", reason: "" });

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>;

  const activePrograms = data.programs.filter((p) => p.status === "ACTIVE");
  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        {data.month}: {data.summary.studentsCovered} student{data.summary.studentsCovered === 1 ? "" : "s"} on concessions · ₹{data.summary.foregone.toLocaleString("en-IN")} not billed this month.
        Concessions apply from the next fee generation; existing fee records are not changed.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Scholarship & CSR programs</CardTitle>
            <CardDescription>A program must be approved by someone with funding approval before concessions can be granted under it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="space-y-2" onSubmit={async (e) => {
              e.preventDefault();
              if (await run(saveScholarshipProgram(prog), "Program created as draft")) { setProg({ name: "", kind: "SCHOLARSHIP", description: "", monthlyBudget: "", sponsorId: "" }); load(); }
            }}>
              <Input required maxLength={120} placeholder="Program name (e.g. Girls' football scholarship)" value={prog.name} onChange={(e) => setProg({ ...prog, name: e.target.value })} className="bg-zinc-900 border-zinc-800" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select aria-label="Program type" value={prog.kind} onChange={(e) => setProg({ ...prog, kind: e.target.value })} className={field}>
                  {PROGRAM_KINDS.map((k) => <option key={k} value={k}>{pretty(k)}</option>)}
                </select>
                <Input type="number" min="0" step="1" placeholder="Monthly budget ₹ (optional)" value={prog.monthlyBudget} onChange={(e) => setProg({ ...prog, monthlyBudget: e.target.value })} className="bg-zinc-900 border-zinc-800" />
                <select aria-label="Funding sponsor" value={prog.sponsorId} onChange={(e) => setProg({ ...prog, sponsorId: e.target.value })} className={field} disabled={!data.sponsors.length}>
                  <option value="">{data.sponsors.length ? "Funded by (optional)" : "Academy-funded"}</option>
                  {data.sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <textarea maxLength={1000} placeholder="Description / eligibility" value={prog.description} onChange={(e) => setProg({ ...prog, description: e.target.value })} className={field} rows={2} />
              <Button size="sm">Create program</Button>
            </form>
            {data.programs.map((p) => (
              <div key={p.id} className="p-3 rounded-md border border-zinc-800 bg-zinc-900">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-100">{p.name}</p>
                    <p className="text-xs text-zinc-500">
                      {pretty(p.kind)}{p.sponsor ? ` · funded by ${p.sponsor.name}` : ""}{p.monthlyBudgetPaise != null ? ` · ${rupees(p.monthlyBudgetPaise)}/month` : ""} · {label(p.status)}
                      {p.approvedAt ? ` · approved ${new Date(p.approvedAt).toLocaleDateString("en-IN")}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {p.status === "DRAFT" && data.canApprove && (
                      <Button size="sm" onClick={async () => {
                        if (!window.confirm(`Approve "${p.name}"${p.monthlyBudgetPaise != null ? ` with a budget of ${rupees(p.monthlyBudgetPaise)}/month` : ""}? Concessions under it reduce fees billed.`)) return;
                        if (await run(setProgramStatus(p.id, "ACTIVE"), "Program approved")) load();
                      }}>Approve</Button>
                    )}
                    {p.status !== "CLOSED" && (
                      <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm("Close this program?") && (await run(setProgramStatus(p.id, "CLOSED"), "Program closed"))) load(); }}>Close</Button>
                    )}
                  </div>
                </div>
                <History entityType="PROGRAM" entityId={p.id} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Fee concessions</CardTitle>
            <CardDescription>Full or partial waivers applied by monthly fee generation. Reasons are visible to staff only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="space-y-2" onSubmit={async (e) => {
              e.preventDefault();
              if (await run(grantConcession(conc), "Concession granted")) { setConc({ ...conc, studentId: "", value: "", reason: "" }); load(); }
            }}>
              <select required aria-label="Student" value={conc.studentId} onChange={(e) => setConc({ ...conc, studentId: e.target.value })} className={field}>
                <option value="">Choose student</option>
                {data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select aria-label="Category" value={conc.category} onChange={(e) => setConc({ ...conc, category: e.target.value })} className={field}>
                  {CONCESSION_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <select aria-label="Program" value={conc.programId} onChange={(e) => setConc({ ...conc, programId: e.target.value })} className={field}>
                  <option value="">No program</option>
                  {activePrograms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Waiver type" value={conc.mode} onChange={(e) => setConc({ ...conc, mode: e.target.value })} className={field}>
                  <option value="FULL">Full waiver</option>
                  <option value="PERCENT">Percent off</option>
                  <option value="AMOUNT">₹ off per month</option>
                </select>
                {conc.mode !== "FULL" && (
                  <Input required type="number" min="1" step="1" placeholder={conc.mode === "PERCENT" ? "% off (1–100)" : "₹ off"} value={conc.value} onChange={(e) => setConc({ ...conc, value: e.target.value })} className="bg-zinc-900 border-zinc-800" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-400">From month<Input required type="month" value={conc.startMonth} onChange={(e) => setConc({ ...conc, startMonth: e.target.value })} className="bg-zinc-900 border-zinc-800" /></label>
                <label className="text-xs text-zinc-400">Until (optional)<Input type="month" value={conc.endMonth} onChange={(e) => setConc({ ...conc, endMonth: e.target.value })} className="bg-zinc-900 border-zinc-800" /></label>
              </div>
              <Input maxLength={300} placeholder="Private reason (staff only)" value={conc.reason} onChange={(e) => setConc({ ...conc, reason: e.target.value })} className="bg-zinc-900 border-zinc-800" />
              <Button size="sm">Grant concession</Button>
            </form>
            {data.concessions.length === 0 && <p className="text-sm text-zinc-500">No concessions yet.</p>}
            {data.concessions.map((c) => (
              <div key={c.id} className={`flex justify-between items-center gap-2 p-2 rounded border border-zinc-800 bg-zinc-900 text-sm ${c.revokedAt ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <p className="text-zinc-100 truncate">{c.studentName} — {describeConcession(c)}</p>
                  <p className="text-xs text-zinc-500">
                    {CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] ?? c.category} · {c.startMonth}{c.endMonth ? ` to ${c.endMonth}` : " onwards"}
                    {c.revokedAt ? " · revoked" : ""}{c.reason ? ` · ${c.reason}` : ""}
                  </p>
                </div>
                {!c.revokedAt && (
                  <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm("Revoke this concession? Future fees will be billed in full.") && (await run(revokeConcession(c.id), "Revoked"))) load(); }}>Revoke</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────────

export function BrandStudioPanel() {
  const tabs = [
    ...(FEATURES.sponsorship ? (["Campaigns", "Sponsors"] as const) : []),
    ...(FEATURES.inclusive ? (["Scholarships"] as const) : []),
  ];
  const [tab, setTab] = useState<string>(tabs[0] ?? "");
  const [data, setData] = useState<Studio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!FEATURES.sponsorship) return;
    const r = await listBrandStudio();
    if (r.success && r.data) { setData(r.data); setError(null); } else setError(r.error ?? "Could not load");
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!tabs.length) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Brand Studio sections">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${tab === t ? "bg-indigo-500 text-white border-indigo-500" : "border-zinc-700 text-zinc-300"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Scholarships" ? (
        <ScholarshipsSection />
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !data ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
      ) : tab === "Sponsors" ? (
        <SponsorsSection data={data} reload={load} />
      ) : (
        <CampaignsSection data={data} reload={load} />
      )}
    </div>
  );
}
