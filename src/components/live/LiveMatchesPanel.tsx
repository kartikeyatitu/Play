"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Plus, Radio, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { BEST_OF, LIVE_SPORTS, type LiveSide } from "@/lib/live-match";
import { createLiveMatch } from "@/app/actions/live-scoring";

export type SquadMember = { id: string; name: string; group?: string | null };
export type LiveMatchListRow = { id: string; title: string; sport: string; status: string; homeName: string; awayName: string | null; line: string; updatedAt: string };

const sportLabel = (k: string) => LIVE_SPORTS.find((s) => s.key === k)?.label ?? k;

/** Match list + "Score a match" for the coach Plan tab and the owner's Live scores page. */
export function LiveMatchesPanel({ rows, squad, canCreate = true }: { rows: LiveMatchListRow[]; squad: SquadMember[]; canCreate?: boolean }) {
  const live = rows.filter((r) => r.status === "LIVE" || r.status === "SCHEDULED");
  const done = rows.filter((r) => r.status === "COMPLETED");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Live scoring</h2>
          <p className="text-xs text-ink-muted">Score point by point. Parents follow live, and results go on each player&apos;s record.</p>
        </div>
        {canCreate && <NewLiveMatchSheet squad={squad} />}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center">
          <Radio className="mx-auto mb-2 h-6 w-6 text-ink-subtle" aria-hidden />
          <p className="text-sm font-semibold text-ink">No matches yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-ink-muted">
            Badminton, table tennis, volleyball, squash, pickleball and tennis can be scored live today. More sports are coming.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {[...live, ...done].map((r) => (
            <li key={r.id}>
              <Link href={`/live/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.status === "LIVE" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-danger">
                        <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden /> Live
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">{r.status === "COMPLETED" ? "Final" : "Not started"}</span>
                    )}
                    <span className="text-[11px] text-ink-subtle">· {sportLabel(r.sport)}</span>
                  </div>
                  <p className="truncate text-sm font-semibold text-ink">
                    {r.homeName} vs {r.awayName || "Opponent"}
                  </p>
                  {r.line && <p className="truncate text-xs tabular-nums text-ink-muted">{r.line}</p>}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewLiveMatchSheet({ squad }: { squad: SquadMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState("badminton");
  const [bestOf, setBestOf] = useState<number>(3);
  const [names, setNames] = useState<Record<LiveSide, string>>({ home: "", away: "" });
  const [picked, setPicked] = useState<Record<LiveSide, string[]>>({ home: [], away: [] });
  const [venue, setVenue] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const r = await createLiveMatch({
      sport,
      bestOf,
      homeName: names.home,
      awayName: names.away,
      homeStudentIds: picked.home,
      awayStudentIds: picked.away,
      venue,
    }).catch(() => null);
    setSaving(false);
    if (!r) return toast.error("You're offline. Try again in a moment.");
    if (!r.success) return toast.error(r.error);
    setOpen(false);
    router.push(`/live/${r.id}`);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title="Score a match"
      description="Pick the sport and who's playing. You can share a live link once it starts."
      className="bg-canvas"
      trigger={
        <button type="button" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-volt px-4 text-sm font-semibold text-volt-fg hover:brightness-110">
          <Plus className="h-4 w-4" /> Score a match
        </button>
      }
    >
      <div className="mx-auto w-full max-w-lg space-y-5 overflow-y-auto pb-2">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Sport</legend>
          <div className="flex flex-wrap gap-2">
            {LIVE_SPORTS.map((s) => (
              <Chip key={s.key} active={sport === s.key} onClick={() => setSport(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Best of</legend>
          <div className="flex gap-2">
            {BEST_OF.map((n) => (
              <Chip key={n} active={bestOf === n} onClick={() => setBestOf(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </fieldset>
        {(["home", "away"] as const).map((side) => (
          <SidePicker
            key={side}
            label={side === "home" ? "Side A" : "Side B"}
            hint={side === "home" ? "Your player(s)" : "Opponent: another player or a name"}
            squad={squad}
            taken={picked[side === "home" ? "away" : "home"]}
            picked={picked[side]}
            onPicked={(ids) => setPicked((p) => ({ ...p, [side]: ids }))}
            name={names[side]}
            onName={(v) => setNames((n) => ({ ...n, [side]: v }))}
          />
        ))}
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">Court or venue (optional)</span>
          <input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            maxLength={80}
            placeholder="Court 2"
            className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-volt focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={saving || (!names.home.trim() && !picked.home.length) || (!names.away.trim() && !picked.away.length)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-volt text-sm font-semibold text-volt-fg hover:brightness-110 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Start scoring
        </button>
      </div>
    </BottomSheet>
  );
}

function SidePicker({
  label,
  hint,
  squad,
  taken,
  picked,
  onPicked,
  name,
  onName,
}: {
  label: string;
  hint: string;
  squad: SquadMember[];
  taken: string[];
  picked: string[];
  onPicked: (ids: string[]) => void;
  name: string;
  onName: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return squad.filter((s) => !taken.includes(s.id) && !picked.includes(s.id) && s.name.toLowerCase().includes(t)).slice(0, 6);
  }, [q, squad, taken, picked]);
  const byId = (id: string) => squad.find((s) => s.id === id);

  return (
    <fieldset className="rounded-2xl border border-line bg-surface p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</legend>
      <p className="mb-2 text-xs text-ink-muted">{hint}</p>
      {picked.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {picked.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-sm font-medium text-ink">
              {byId(id)?.name ?? "Player"}
              <button type="button" onClick={() => onPicked(picked.filter((x) => x !== id))} className="rounded-full p-1 hover:bg-line" aria-label={`Remove ${byId(id)?.name ?? "player"}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {picked.length < 2 && squad.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={picked.length ? "Add a doubles partner" : "Search your squad"}
            className="h-11 w-full rounded-xl border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-volt focus:outline-none"
          />
          {matches.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-xl border border-line bg-canvas">
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPicked([...picked, s.id]);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="truncate font-medium text-ink">{s.name}</span>
                    {s.group && <span className="shrink-0 text-xs text-ink-subtle">{s.group}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        maxLength={60}
        placeholder={picked.length ? "Display name (optional)" : "Or type a name, e.g. DPS Noida"}
        className="mt-2 h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-volt focus:outline-none"
      />
    </fieldset>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-10 rounded-full border px-4 text-sm font-semibold transition",
        active ? "border-volt bg-volt text-volt-fg" : "border-line bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
