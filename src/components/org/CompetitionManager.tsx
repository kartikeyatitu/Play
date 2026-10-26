"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Plus, Trophy } from "lucide-react";
import {
  createCompetition,
  generateFixtures,
  getCompetition,
  listCompetitions,
  recordFixtureResult,
  registerEntry,
  scheduleFixture,
  searchCompetitionStudents,
  setCompetitionStatus,
  withdrawEntry,
} from "@/app/actions/competitions";
import type { CompetitionDetail, CompetitionSummary, FixtureView } from "@/lib/competition-view";

/**
 * TRIQ Play organiser screen (flag `events`). Replaces the old in-memory TournamentBracket: everything
 * here is persisted and every rule is enforced on the server (src/lib/competition.ts).
 */

const field = "w-full min-h-[40px] rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-sm text-zinc-100 focus:outline-none focus:border-lime-400/60";
const label = "block text-xs text-zinc-400 mb-1";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 min-h-[36px] text-sm font-medium disabled:opacity-50";
const primary = `${btn} bg-lime-400 text-zinc-950 hover:bg-lime-300`;
const ghost = `${btn} border border-zinc-800 text-zinc-200 hover:bg-zinc-900`;
const card = "rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Registration open",
  SCHEDULED: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "OPEN" ? "bg-sky-500/15 text-sky-200" : status === "SCHEDULED" ? "bg-lime-400/15 text-lime-200" : status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-200" : status === "CANCELLED" ? "bg-red-500/15 text-red-200" : "bg-zinc-800 text-zinc-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{STATUS_LABEL[status] ?? status}</span>;
}

const toIstInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : "");
const fmtIst = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Time TBC";

type Batch = { id: string; name: string };

export function CompetitionManager({ batches }: { batches: Batch[] }) {
  const [list, setList] = useState<CompetitionSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listCompetitions();
    if (r.success) {
      setList(r.competitions);
      setError(null);
    } else setError(r.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (openId) return <CompetitionView id={openId} batches={batches} onBack={() => (setOpenId(null), void load())} />;
  if (creating)
    return (
      <CreateCompetition
        batches={batches}
        onCancel={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          setOpenId(id);
        }}
      />
    );

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Trophy className="h-4 w-4 text-lime-300" /> Competitions
        </h3>
        <button className={primary} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New
        </button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!list && !error && <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
      {list && list.length === 0 && <p className="text-sm text-zinc-400">No competitions yet. Create a league or knockout cup to get started.</p>}
      <ul className="divide-y divide-zinc-800">
        {list?.map((c) => (
          <li key={c.id}>
            <button className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-zinc-900/60 rounded-lg px-2" onClick={() => setOpenId(c.id)}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                <p className="text-xs text-zinc-400">
                  {c.format === "LEAGUE" ? "League" : "Knockout"} · {c.entryType === "TEAM" ? "Teams" : "Individuals"} · {c.entryCount}/{c.maxEntries} entries
                  {c.startDate ? ` · ${c.startDate}` : ""}
                </p>
              </div>
              <StatusChip status={c.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────────── create ─────────────────────────────

function CreateCompetition({ batches, onCancel, onCreated }: { batches: Batch[]; onCancel: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({
    name: "",
    sport: "",
    format: "LEAGUE",
    entryType: "TEAM",
    legs: "1",
    startDate: "",
    endDate: "",
    venue: "",
    maxEntries: "8",
    minAge: "",
    maxAge: "",
    ageCutoffDate: "",
    eligibleBatchId: "",
    pointsWin: "3",
    pointsDraw: "1",
    pointsLoss: "0",
    allowDraws: true,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await createCompetition(f);
    setBusy(false);
    if (r.success) {
      toast.success("Competition created");
      onCreated(r.id);
    } else toast.error(r.error);
  };

  return (
    <form className={`${card} space-y-3`} onSubmit={submit}>
      <div className="flex items-center gap-2">
        <button type="button" className={ghost} onClick={onCancel} aria-label="Back">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="font-semibold text-white">New competition</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={label}>Name</label>
          <input className={field} value={f.name} onChange={set("name")} required minLength={3} maxLength={80} placeholder="Winter U-14 League" />
        </div>
        <div>
          <label className={label}>Sport</label>
          <input className={field} value={f.sport} onChange={set("sport")} maxLength={40} placeholder="Football" />
        </div>
        <div>
          <label className={label}>Venue</label>
          <input className={field} value={f.venue} onChange={set("venue")} maxLength={120} />
        </div>
        <div>
          <label className={label}>Format</label>
          <select className={field} value={f.format} onChange={set("format")}>
            <option value="LEAGUE">League (round-robin)</option>
            <option value="KNOCKOUT">Knockout (single elimination)</option>
          </select>
        </div>
        <div>
          <label className={label}>Entries</label>
          <select className={field} value={f.entryType} onChange={set("entryType")}>
            <option value="TEAM">Teams</option>
            <option value="INDIVIDUAL">Individual players (your students)</option>
          </select>
        </div>
        {f.format === "LEAGUE" && (
          <div>
            <label className={label}>Play each other</label>
            <select className={field} value={f.legs} onChange={set("legs")}>
              <option value="1">Once</option>
              <option value="2">Twice (home and away)</option>
            </select>
          </div>
        )}
        <div>
          <label className={label}>Maximum entries</label>
          <input className={field} type="number" min={2} max={f.format === "KNOCKOUT" ? 64 : 128} value={f.maxEntries} onChange={set("maxEntries")} required />
        </div>
        <div>
          <label className={label}>Start date</label>
          <input className={field} type="date" value={f.startDate} onChange={set("startDate")} />
        </div>
        <div>
          <label className={label}>End date</label>
          <input className={field} type="date" value={f.endDate} onChange={set("endDate")} />
        </div>
      </div>

      {f.entryType === "INDIVIDUAL" && (
        <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-zinc-800 pt-3">
          <legend className="text-xs text-zinc-400 mb-1">Eligibility (optional)</legend>
          <div>
            <label className={label}>Min age</label>
            <input className={field} type="number" min={3} max={80} value={f.minAge} onChange={set("minAge")} />
          </div>
          <div>
            <label className={label}>Max age</label>
            <input className={field} type="number" min={3} max={80} value={f.maxAge} onChange={set("maxAge")} />
          </div>
          <div>
            <label className={label}>Age on date</label>
            <input className={field} type="date" value={f.ageCutoffDate} onChange={set("ageCutoffDate")} />
          </div>
          <div>
            <label className={label}>Only batch</label>
            <select className={field} value={f.eligibleBatchId} onChange={set("eligibleBatchId")}>
              <option value="">Any</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      )}

      {f.format === "LEAGUE" && (
        <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-zinc-800 pt-3">
          <legend className="text-xs text-zinc-400 mb-1">Points</legend>
          <div>
            <label className={label}>Win</label>
            <input className={field} type="number" min={0} max={10} value={f.pointsWin} onChange={set("pointsWin")} />
          </div>
          <div>
            <label className={label}>Draw</label>
            <input className={field} type="number" min={0} max={10} value={f.pointsDraw} onChange={set("pointsDraw")} />
          </div>
          <div>
            <label className={label}>Loss</label>
            <input className={field} type="number" min={0} max={10} value={f.pointsLoss} onChange={set("pointsLoss")} />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 mt-5">
            <input type="checkbox" checked={f.allowDraws} onChange={set("allowDraws")} /> Draws allowed
          </label>
        </fieldset>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className={ghost} onClick={onCancel}>
          Cancel
        </button>
        <button className={primary} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create
        </button>
      </div>
    </form>
  );
}

// ───────────────────────────── detail ─────────────────────────────

function CompetitionView({ id, batches, onBack }: { id: string; batches: Batch[]; onBack: () => void }) {
  const [c, setC] = useState<CompetitionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await getCompetition(id);
    if (r.success) {
      setC(r.competition);
      setError(null);
    } else setError(r.error);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.success) toast.success(ok);
    else toast.error(r.error ?? "Something went wrong");
    await load();
  };

  if (error) return <div className={card}><button className={ghost} onClick={onBack}><ChevronLeft className="h-4 w-4" /> Back</button><p className="mt-3 text-sm text-red-300">{error}</p></div>;
  if (!c) return <div className={card}><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>;

  const regOpen = c.status === "DRAFT" || c.status === "OPEN";
  const registered = c.entries.filter((e) => e.status === "REGISTERED");
  const names = new Map(c.entries.map((e) => [e.id, e.name]));
  const rounds = [...new Set(c.fixtures.map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-start gap-2">
          <button className={ghost} onClick={onBack} aria-label="Back">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">{c.name}</h3>
              <StatusChip status={c.status} />
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {c.format === "LEAGUE" ? `League${c.legs === 2 ? " · home & away" : ""} · ${c.pointsWin}/${c.pointsDraw}/${c.pointsLoss} pts` : "Knockout"} ·{" "}
              {c.entryType === "TEAM" ? "Teams" : "Individuals"} · {registered.length}/{c.maxEntries} entries
              {c.startDate ? ` · ${c.startDate}${c.endDate ? ` → ${c.endDate}` : ""}` : ""}
              {c.venue ? ` · ${c.venue}` : ""}
              {c.minAge !== null || c.maxAge !== null ? ` · Age ${c.minAge ?? "any"}–${c.maxAge ?? "any"} on ${c.ageCutoffDate}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {c.status === "DRAFT" && <button className={primary} disabled={busy} onClick={() => run(() => setCompetitionStatus(c.id, "OPEN"), "Registration opened")}>Open registration</button>}
          {c.status === "OPEN" && (
            <>
              <button className={primary} disabled={busy || registered.length < 2} onClick={() => run(() => generateFixtures(c.id), "Fixtures generated")}>
                Generate fixtures
              </button>
              <button className={ghost} disabled={busy} onClick={() => run(() => setCompetitionStatus(c.id, "DRAFT"), "Back to draft")}>Back to draft</button>
            </>
          )}
          {c.status === "SCHEDULED" && (
            <button className={primary} disabled={busy || !c.allDecided} onClick={() => run(() => setCompetitionStatus(c.id, "COMPLETED"), "Competition completed")}>
              Mark completed
            </button>
          )}
          {["DRAFT", "OPEN", "SCHEDULED"].includes(c.status) && (
            <button
              className={`${ghost} text-red-300`}
              disabled={busy}
              onClick={() => confirm("Cancel this competition? This can't be undone.") && run(() => setCompetitionStatus(c.id, "CANCELLED"), "Competition cancelled")}
            >
              Cancel competition
            </button>
          )}
        </div>
        {c.format === "KNOCKOUT" && c.championEntryId && (
          <p className="mt-3 text-sm text-lime-200 flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Winner: {names.get(c.championEntryId)}
          </p>
        )}
      </div>

      <div className={card}>
        <h4 className="text-sm font-semibold text-white mb-2">Entries</h4>
        {regOpen && <AddEntry c={c} batches={batches} onDone={load} />}
        {c.entries.length === 0 ? (
          <p className="text-sm text-zinc-400">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 mt-2">
            {c.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span className={e.status === "WITHDRAWN" ? "text-zinc-500 line-through" : "text-zinc-100"}>
                  {e.seed ? <span className="text-xs text-lime-300 mr-1">#{e.seed}</span> : null}
                  {e.name}
                </span>
                {regOpen && e.status === "REGISTERED" && (
                  <button className="text-xs text-zinc-400 hover:text-red-300" disabled={busy} onClick={() => run(() => withdrawEntry(e.id), "Entry withdrawn")}>
                    Withdraw
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {c.format === "LEAGUE" && c.fixtures.length > 0 && (
        <div className={card}>
          <h4 className="text-sm font-semibold text-white mb-2">Standings</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-400">
                <tr className="text-left">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Entry</th>
                  <th className="py-1 px-1 text-right">P</th>
                  <th className="py-1 px-1 text-right">W</th>
                  <th className="py-1 px-1 text-right">D</th>
                  <th className="py-1 px-1 text-right">L</th>
                  <th className="py-1 px-1 text-right">+/-</th>
                  <th className="py-1 pl-1 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {c.standings.map((r) => (
                  <tr key={r.entryId} className="border-t border-zinc-800 text-zinc-100">
                    <td className="py-1.5 pr-2 text-zinc-400">{r.position}</td>
                    <td className="py-1.5 pr-2">{r.name}</td>
                    <td className="py-1.5 px-1 text-right">{r.played}</td>
                    <td className="py-1.5 px-1 text-right">{r.won}</td>
                    <td className="py-1.5 px-1 text-right">{r.drawn}</td>
                    <td className="py-1.5 px-1 text-right">{r.lost}</td>
                    <td className="py-1.5 px-1 text-right">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                    <td className="py-1.5 pl-1 text-right font-semibold">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">Ties: points, head-to-head, score difference, scores for, wins, name.</p>
        </div>
      )}

      {rounds.length > 0 && (
        <div className={card}>
          <h4 className="text-sm font-semibold text-white mb-2">Fixtures</h4>
          <div className="space-y-4">
            {rounds.map((r) => (
              <div key={r}>
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{roundName(c, r)}</p>
                <ul className="space-y-2">
                  {c.fixtures
                    .filter((f) => f.round === r)
                    .map((f) => (
                      <FixtureRow key={`${f.id}:${f.version}`} c={c} f={f} onDone={load} />
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function roundName(c: CompetitionDetail, r: number) {
  if (c.format !== "KNOCKOUT") return `Round ${r}`;
  const left = c.totalRounds - r;
  return left === 0 ? "Final" : left === 1 ? "Semi-finals" : left === 2 ? "Quarter-finals" : `Round ${r}`;
}

function AddEntry({ c, batches, onDone }: { c: CompetitionDetail; batches: Batch[]; onDone: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [seed, setSeed] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (c.entryType !== "INDIVIDUAL") return;
    const t = setTimeout(async () => {
      const r = await searchCompetitionStudents(q);
      if (r.success) setResults(r.students);
    }, 250);
    return () => clearTimeout(t);
  }, [q, c.entryType]);

  const add = async (input: { name?: string; studentId?: string; batchId?: string }) => {
    setBusy(true);
    const r = await registerEntry(c.id, { ...input, seed: seed || null });
    setBusy(false);
    if (r.success) {
      toast.success("Registered");
      setName("");
      setSeed("");
      await onDone();
    } else toast.error(r.error);
  };

  if (c.entryType === "INDIVIDUAL") {
    const already = new Set(c.entries.filter((e) => e.status === "REGISTERED").map((e) => e.studentId));
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input className={field} placeholder="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
          <input className={`${field} max-w-[90px]`} placeholder="Seed" type="number" min={1} max={128} value={seed} onChange={(e) => setSeed(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {results
            .filter((s) => !already.has(s.id))
            .map((s) => (
              <button key={s.id} className={ghost} disabled={busy} onClick={() => add({ studentId: s.id })}>
                <Plus className="h-3 w-3" /> {s.name}
              </button>
            ))}
        </div>
      </div>
    );
  }
  return (
    <form
      className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px_auto] gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void add({ name, batchId: batchId || undefined });
      }}
    >
      <input className={field} placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
      <select className={field} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
        <option value="">No batch (external team)</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <input className={field} placeholder="Seed" type="number" min={1} max={128} value={seed} onChange={(e) => setSeed(e.target.value)} />
      <button className={primary} disabled={busy}>
        Add
      </button>
    </form>
  );
}

function FixtureRow({ c, f, onDone }: { c: CompetitionDetail; f: FixtureView; onDone: () => Promise<void> }) {
  const [home, setHome] = useState(f.homeScore?.toString() ?? "");
  const [away, setAway] = useState(f.awayScore?.toString() ?? "");
  const [winner, setWinner] = useState(f.winnerEntryId ?? "");
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(toIstInput(f.scheduledAt));
  const [venue, setVenue] = useState(f.venue ?? "");
  const [official, setOfficial] = useState(f.officialUserId ?? "");
  const [status, setStatus] = useState(f.status === "POSTPONED" || f.status === "CANCELLED" ? f.status : "SCHEDULED");
  const [busy, setBusy] = useState(false);

  const running = c.status === "SCHEDULED";
  const ready = !!f.homeEntryId && !!f.awayEntryId && f.status !== "BYE" && f.status !== "CANCELLED";
  const tie = c.format === "KNOCKOUT" && home !== "" && home === away;

  const saveResult = async () => {
    setBusy(true);
    const r = await recordFixtureResult(f.id, { homeScore: home, awayScore: away, winnerEntryId: tie ? winner : null, expectedVersion: f.version });
    setBusy(false);
    if (r.success) toast.success("Result saved");
    else toast.error(r.error);
    await onDone();
  };
  const saveSchedule = async () => {
    setBusy(true);
    const r = await scheduleFixture(f.id, {
      scheduledAt: when || null,
      venue,
      officialUserId: official || null,
      status: f.status === "COMPLETED" ? undefined : status,
      expectedVersion: f.version,
    });
    setBusy(false);
    if (r.success) {
      toast.success("Fixture updated");
      setEditing(false);
    } else toast.error(r.error);
    await onDone();
  };

  if (f.status === "BYE") {
    return <li className="text-xs text-zinc-500 px-2">{f.homeName ?? f.awayName} — bye</li>;
  }
  const officialName = c.officials.find((o) => o.userId === f.officialUserId)?.name;

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`flex-1 min-w-[90px] text-right ${f.winnerEntryId && f.winnerEntryId === f.homeEntryId ? "text-lime-200 font-semibold" : "text-zinc-100"}`}>{f.homeName ?? "TBD"}</span>
        {ready && running ? (
          <>
            <input aria-label="Home score" className={`${field} w-14 text-center`} inputMode="numeric" value={home} onChange={(e) => setHome(e.target.value)} />
            <span className="text-zinc-500">–</span>
            <input aria-label="Away score" className={`${field} w-14 text-center`} inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value)} />
          </>
        ) : (
          <span className="text-zinc-300 w-20 text-center">{f.status === "COMPLETED" ? `${f.homeScore} – ${f.awayScore}` : "vs"}</span>
        )}
        <span className={`flex-1 min-w-[90px] ${f.winnerEntryId && f.winnerEntryId === f.awayEntryId ? "text-lime-200 font-semibold" : "text-zinc-100"}`}>{f.awayName ?? "TBD"}</span>
      </div>
      {tie && ready && running && (
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
          Went through:
          <select className={`${field} max-w-[200px]`} value={winner} onChange={(e) => setWinner(e.target.value)}>
            <option value="">Pick winner</option>
            <option value={f.homeEntryId!}>{f.homeName}</option>
            <option value={f.awayEntryId!}>{f.awayName}</option>
          </select>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <span>
          {fmtIst(f.scheduledAt)}
          {f.venue ? ` · ${f.venue}` : ""}
          {officialName ? ` · Official: ${officialName}` : ""}
          {f.status === "POSTPONED" ? " · Postponed" : f.status === "CANCELLED" ? " · Cancelled" : ""}
        </span>
        {running && (
          <span className="flex gap-2">
            <button className={ghost} onClick={() => setEditing((v) => !v)}>
              Schedule
            </button>
            {ready && f.status !== "POSTPONED" && (
              <button className={primary} disabled={busy || home === "" || away === ""} onClick={saveResult}>
                {f.status === "COMPLETED" ? "Correct" : "Save result"}
              </button>
            )}
          </span>
        )}
      </div>
      {editing && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input className={field} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date and time (IST)" />
          <input className={field} placeholder="Venue / court" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={120} />
          <select className={field} value={official} onChange={(e) => setOfficial(e.target.value)} aria-label="Official">
            <option value="">No official</option>
            {c.officials.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {f.status !== "COMPLETED" && (
              <select className={field} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                <option value="SCHEDULED">Scheduled</option>
                <option value="POSTPONED">Postponed</option>
                {c.format === "LEAGUE" && <option value="CANCELLED">Cancelled</option>}
              </select>
            )}
            <button className={primary} disabled={busy} onClick={saveSchedule}>
              Save
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
