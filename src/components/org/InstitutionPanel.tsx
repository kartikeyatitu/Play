"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteParticipation,
  getInstitutionOverview,
  linkTeam,
  listParticipation,
  recordParticipation,
  saveInstitutionProfile,
  saveProgram,
  setProgramStatus,
  unlinkTeam,
} from "@/app/actions/education";
import {
  INSTITUTION_KINDS,
  INSTITUTION_KIND_LABELS,
  PARTICIPATION_KINDS,
  PARTICIPATION_KIND_LABELS,
  SQUAD_TYPES,
  type InstitutionKind,
  type ParticipationKind,
} from "@/lib/education";

type Overview = Extract<Awaited<ReturnType<typeof getInstitutionOverview>>, { success: true }>;
type Program = Overview["programs"][number];
type Participation = Extract<Awaited<ReturnType<typeof listParticipation>>, { success: true }>;

const field = "w-full h-10 rounded-lg bg-surface border border-line px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-volt/30";
const small = "rounded-md border border-line px-2.5 py-1 text-xs text-ink hover:bg-surface disabled:opacity-50";
const day = (v: string | Date) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Result = { success: boolean; error?: string };

export function InstitutionPanel() {
  const [data, setData] = React.useState<Overview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [profileForm, setProfileForm] = React.useState<{ kind: string; affiliation: string; levels: string; website: string } | null>(null);
  const [programForm, setProgramForm] = React.useState<{ id?: string; name: string; sport: string; description: string } | null>(null);
  const [openProgram, setOpenProgram] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await getInstitutionOverview();
    if (res.success) { setData(res); setError(null); } else setError(res.error);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const act = (fn: () => Promise<Result>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.success) { toast.success(ok); after?.(); await load(); } else toast.error(res.error || "Something went wrong");
    });

  if (error) return <p className="text-sm text-ink-muted">{error}</p>;
  if (!data) return <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  const p = data.profile;
  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">Institution profile</h3>
            {p ? (
              <p className="text-sm text-ink-muted">
                {[INSTITUTION_KIND_LABELS[p.kind as InstitutionKind] ?? p.kind, p.affiliation, p.levels].filter(Boolean).join(" · ")}
                {p.website && <> · <a className="underline" href={p.website} target="_blank" rel="noopener noreferrer">website</a></>}
              </p>
            ) : (
              <p className="text-sm text-ink-muted">Set this up if you are a school, college or university.</p>
            )}
          </div>
          {data.canEditProfile && !profileForm && (
            <button className={small} onClick={() => setProfileForm({ kind: p?.kind ?? "SCHOOL", affiliation: p?.affiliation ?? "", levels: p?.levels ?? "", website: p?.website ?? "" })}>
              {p ? "Edit" : "Set up"}
            </button>
          )}
        </div>
        {profileForm && (
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); act(() => saveInstitutionProfile(profileForm), "Profile saved", () => setProfileForm(null)); }}>
            <select className={field} value={profileForm.kind} onChange={(e) => setProfileForm({ ...profileForm, kind: e.target.value })} aria-label="Type">
              {INSTITUTION_KINDS.map((k) => <option key={k} value={k}>{INSTITUTION_KIND_LABELS[k]}</option>)}
            </select>
            <input className={field} maxLength={80} placeholder="Board / affiliation, e.g. CBSE" value={profileForm.affiliation} onChange={(e) => setProfileForm({ ...profileForm, affiliation: e.target.value })} />
            <input className={field} maxLength={80} placeholder="Levels, e.g. Grades 1–12" value={profileForm.levels} onChange={(e) => setProfileForm({ ...profileForm, levels: e.target.value })} />
            <input className={field} type="url" placeholder="Website (optional)" value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>Save</Button>
              <Button type="button" variant="outline" onClick={() => setProfileForm(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </section>

      {/* Programs */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">Sports programs</h3>
            <p className="text-xs text-ink-muted">Teams and squads are your existing batches — rosters, coaches, schedules and attendance stay where they are. Figures cover the last {data.windowDays} days.</p>
          </div>
          {data.canManagePrograms && !programForm && <Button onClick={() => setProgramForm({ name: "", sport: "", description: "" })}><Plus className="mr-1 h-4 w-4" />New program</Button>}
        </div>

        {programForm && (
          <form className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); act(() => saveProgram(programForm, programForm.id), "Program saved", () => setProgramForm(null)); }}>
            <input className={field} required minLength={2} maxLength={80} placeholder="Program name, e.g. Football" value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} />
            <input className={field} required minLength={2} maxLength={40} placeholder="Sport" value={programForm.sport} onChange={(e) => setProgramForm({ ...programForm, sport: e.target.value })} />
            <textarea className={`${field} h-20 py-2 sm:col-span-2`} maxLength={500} placeholder="Description (optional)" value={programForm.description} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>Save</Button>
              <Button type="button" variant="outline" onClick={() => setProgramForm(null)}>Cancel</Button>
            </div>
          </form>
        )}

        {data.programs.map((prog) => (
          <ProgramCard
            key={prog.id}
            program={prog}
            data={data}
            pending={pending}
            act={act}
            open={openProgram === prog.id}
            onToggle={() => setOpenProgram(openProgram === prog.id ? null : prog.id)}
            onEdit={() => setProgramForm({ id: prog.id, name: prog.name, sport: prog.sport, description: prog.description ?? "" })}
          />
        ))}
        {data.programs.length === 0 && !programForm && <p className="text-sm text-ink-muted">No programs yet.</p>}
      </section>
    </div>
  );
}

function ProgramCard({ program, data, pending, act, open, onToggle, onEdit }: {
  program: Program;
  data: Overview;
  pending: boolean;
  act: (fn: () => Promise<Result>, ok: string, after?: () => void) => void;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const m = program.metrics;
  const [teamForm, setTeamForm] = React.useState<{ batchId: string; squadType: string; ageGroup: string; gender: string } | null>(null);
  const [part, setPart] = React.useState<Participation | null>(null);
  const [partError, setPartError] = React.useState<string | null>(null);
  const [recForm, setRecForm] = React.useState<{ studentId: string; kind: string; title: string; date: string; role: string; result: string; notes: string } | null>(null);
  const freeBatches = data.batches.filter((b) => !b.linked);

  const loadPart = React.useCallback(async () => {
    const res = await listParticipation(program.id);
    if (res.success) { setPart(res); setPartError(null); } else setPartError(res.error);
  }, [program.id]);
  React.useEffect(() => { if (open) void loadPart(); }, [open, loadPart]);

  return (
    <div className={`rounded-xl border border-line p-4 ${program.status === "ARCHIVED" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{program.name} <span className="text-xs font-normal text-ink-muted">· {program.sport}{program.status === "ARCHIVED" ? " · archived" : ""}</span></p>
          {program.description && <p className="text-xs text-ink-muted">{program.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {data.canManagePrograms && <button className={small} onClick={onEdit}>Edit</button>}
          {data.canManagePrograms && (
            <button className={small} disabled={pending} onClick={() => act(() => setProgramStatus(program.id, program.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"), program.status === "ACTIVE" ? "Archived" : "Re-activated")}>
              {program.status === "ACTIVE" ? "Archive" : "Re-activate"}
            </button>
          )}
          <button className={small} onClick={onToggle}>{open ? "Hide" : "Details"}</button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Metric label="Teams" value={m.teams} />
        <Metric label="Students" value={m.students} />
        <Metric label="Sessions held" value={m.sessionsHeld} />
        <Metric label="Attendance" value={m.attendanceRate === null ? "—" : `${m.attendanceRate}%`} />
        <Metric label="Records" value={Object.values(m.records).reduce((s, n) => s + (n ?? 0), 0)} />
      </dl>
      {m.unmarkedSessions > 0 && <p className="mt-1 text-[11px] text-ink-muted">{m.unmarkedSessions} session{m.unmarkedSessions === 1 ? "" : "s"} without attendance marks (not counted).</p>}

      {open && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {/* Teams */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink">Teams &amp; squads</h4>
              {data.canManagePrograms && program.status === "ACTIVE" && !teamForm && freeBatches.length > 0 && (
                <button className={small} onClick={() => setTeamForm({ batchId: freeBatches[0].id, squadType: "TEAM", ageGroup: "", gender: "" })}>Link a batch</button>
              )}
            </div>
            {teamForm && (
              <form className="mb-3 grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); act(() => linkTeam(program.id, teamForm), "Team linked", () => setTeamForm(null)); }}>
                <select className={`${field} sm:col-span-2`} value={teamForm.batchId} onChange={(e) => setTeamForm({ ...teamForm, batchId: e.target.value })} aria-label="Batch">
                  {freeBatches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.sport})</option>)}
                </select>
                <select className={field} value={teamForm.squadType} onChange={(e) => setTeamForm({ ...teamForm, squadType: e.target.value })} aria-label="Type">
                  {SQUAD_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                </select>
                <select className={field} value={teamForm.gender} onChange={(e) => setTeamForm({ ...teamForm, gender: e.target.value })} aria-label="Gender">
                  <option value="">Any</option><option value="BOYS">Boys</option><option value="GIRLS">Girls</option><option value="MIXED">Mixed</option>
                </select>
                <input className={field} maxLength={20} placeholder="Age group, e.g. U-14" value={teamForm.ageGroup} onChange={(e) => setTeamForm({ ...teamForm, ageGroup: e.target.value })} />
                <div className="flex gap-2 sm:col-span-3">
                  <Button type="submit" disabled={pending}>Link</Button>
                  <Button type="button" variant="outline" onClick={() => setTeamForm(null)}>Cancel</Button>
                </div>
              </form>
            )}
            <ul className="space-y-1 text-sm">
              {program.teams.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                  <span className="text-ink">{t.batchName} <span className="text-xs text-ink-muted">· {[t.squadType.toLowerCase(), t.ageGroup, t.gender?.toLowerCase(), t.coachName ? `coach ${t.coachName}` : null, `${t.roster} students`, t.schedule].filter(Boolean).join(" · ")}</span></span>
                  {data.canManagePrograms && <button className={small} disabled={pending} onClick={() => { if (window.confirm("Unlink this batch? Its roster and attendance are kept.")) act(() => unlinkTeam(t.id), "Unlinked"); }}>Unlink</button>}
                </li>
              ))}
              {program.teams.length === 0 && <li className="text-xs text-ink-muted">No teams yet. Link an existing batch to use its roster and attendance.</li>}
            </ul>
          </div>

          {/* Participation */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink">Participation records</h4>
              {data.canRecord && program.status === "ACTIVE" && part && part.roster.length > 0 && !recForm && (
                <button className={small} onClick={() => setRecForm({ studentId: part.roster[0].id, kind: "COMPETITION", title: "", date: "", role: "", result: "", notes: "" })}>Record participation</button>
              )}
            </div>
            {partError && <p className="text-xs text-ink-muted">{partError}</p>}
            {recForm && part && (
              <form className="mb-3 grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); act(() => recordParticipation(program.id, recForm), "Recorded", () => { setRecForm(null); void loadPart(); }); }}>
                <select className={field} value={recForm.studentId} onChange={(e) => setRecForm({ ...recForm, studentId: e.target.value })} aria-label="Student">
                  {part.roster.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className={field} value={recForm.kind} onChange={(e) => setRecForm({ ...recForm, kind: e.target.value })} aria-label="Type">
                  {PARTICIPATION_KINDS.map((k) => <option key={k} value={k}>{PARTICIPATION_KIND_LABELS[k]}</option>)}
                </select>
                <input className={field} type="date" required value={recForm.date} onChange={(e) => setRecForm({ ...recForm, date: e.target.value })} aria-label="Date" />
                <input className={`${field} sm:col-span-3`} required minLength={3} maxLength={120} placeholder="What, e.g. Inter-school football final" value={recForm.title} onChange={(e) => setRecForm({ ...recForm, title: e.target.value })} />
                <input className={field} maxLength={60} placeholder="Role, e.g. Captain" value={recForm.role} onChange={(e) => setRecForm({ ...recForm, role: e.target.value })} />
                <input className={field} maxLength={80} placeholder="Result, e.g. Won 2–1" value={recForm.result} onChange={(e) => setRecForm({ ...recForm, result: e.target.value })} />
                <input className={field} maxLength={500} placeholder="Notes (optional)" value={recForm.notes} onChange={(e) => setRecForm({ ...recForm, notes: e.target.value })} />
                <div className="flex gap-2 sm:col-span-3">
                  <Button type="submit" disabled={pending}>Save</Button>
                  <Button type="button" variant="outline" onClick={() => setRecForm(null)}>Cancel</Button>
                </div>
              </form>
            )}
            {!part && !partError && <p className="text-xs text-ink-muted">Loading…</p>}
            {part && (
              <ul className="space-y-1 text-sm">
                {part.records.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="text-ink">
                      {r.studentName} — {r.title}
                      <span className="text-xs text-ink-muted"> · {[PARTICIPATION_KIND_LABELS[r.kind as ParticipationKind] ?? r.kind, r.role, r.result, day(r.date)].filter(Boolean).join(" · ")}</span>
                    </span>
                    {data.canRecord && <button className={small} disabled={pending} onClick={() => { if (window.confirm("Delete this record?")) act(() => deleteParticipation(r.id), "Deleted", () => void loadPart()); }}>Delete</button>}
                  </li>
                ))}
                {part.records.length === 0 && <li className="text-xs text-ink-muted">No participation recorded yet.</li>}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
