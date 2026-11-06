"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";
import { getFixturesBoard, listFixtureCompetitions } from "@/app/actions/fixtures";
import type { FixtureCard, FixtureCompetitionOption, FixturesBoard } from "@/lib/competition/board";
import { BracketView } from "./BracketView";
import { FixtureList } from "./FixtureList";
import { ResultSheet } from "./ResultSheet";
import { SetupPanel } from "./SetupPanel";
import { StandingsTables } from "./StandingsTables";
import { card, inputCls, labelCls, MODE_LABEL, STATUS_LABEL } from "./styles";

type Tab = "fixtures" | "table" | "bracket" | "setup";
type Loaded = { board: FixturesBoard; liveScoring: boolean; entrySeeds: { id: string; seed: number | null; createdAt: string }[] };

/** Organiser workspace: pick a competition, make the draw, schedule, enter results, see tables and bracket. */
export function FixturesWorkspace({ initialId }: { initialId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [list, setList] = useState<FixtureCompetitionOption[] | null>(null);
  const [id, setId] = useState<string | null>(initialId);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("fixtures");
  const [open, setOpen] = useState<FixtureCard | null>(null);

  useEffect(() => {
    void listFixtureCompetitions().then((r) => {
      if (!r.success) return setError(r.error);
      setList(r.competitions);
      setId((cur) => cur ?? r.competitions[0]?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await getFixturesBoard(id);
    if (r.success) {
      setData({ board: r.board, liveScoring: r.liveScoring, entrySeeds: r.entrySeeds });
      setError(null);
    } else setError(r.error);
  }, [id]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const pick = (next: string) => {
    setId(next);
    setTab("fixtures");
    router.replace(`${pathname}?c=${encodeURIComponent(next)}`, { scroll: false });
  };

  const board = data?.board;
  useEffect(() => {
    if (board && !board.hasFixtures) setTab("setup");
  }, [board]);

  const tabs: { key: Tab; label: string }[] = board
    ? [
        { key: "fixtures", label: "Fixtures" },
        ...(board.tables.length ? [{ key: "table" as const, label: board.mode === "GROUPS" ? "Groups" : "Table" }] : []),
        ...(board.bracket.length ? [{ key: "bracket" as const, label: "Bracket" }] : []),
        { key: "setup", label: "Setup" },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Fixtures</h1>
        <p className="text-xs text-ink-muted">Draws, schedules, results, tables and brackets for your competitions.</p>
      </div>

      {list && list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center">
          <Trophy className="mx-auto mb-2 h-6 w-6 text-ink-subtle" aria-hidden />
          <p className="text-sm font-semibold text-ink">No competitions ready</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">Create a competition and open registration from the Competitions screen, then come back to make the draw.</p>
        </div>
      )}

      {list && list.length > 0 && (
        <div>
          <label className={labelCls} htmlFor="fx-comp">Competition</label>
          <select id="fx-comp" className={inputCls} value={id ?? ""} onChange={(e) => pick(e.target.value)}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {STATUS_LABEL[c.status] ?? c.status}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && id && !board && <Loader2 className="h-5 w-5 animate-spin text-ink-subtle" aria-label="Loading" />}

      {board && data && (
        <div key={board.competition.id} className="space-y-4">
          <div className={card}>
            <p className="text-sm font-semibold text-ink">{board.competition.name}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {board.hasFixtures ? MODE_LABEL[board.mode] : board.competition.format === "KNOCKOUT" ? "Knockout" : "League"} · {board.entries.length} entries ·{" "}
              {STATUS_LABEL[board.competition.status] ?? board.competition.status}
              {board.competition.sport ? ` · ${board.competition.sport}` : ""}
              {board.mode !== "KNOCKOUT" ? ` · ${board.competition.points.pointsWin}/${board.competition.points.pointsDraw}/${board.competition.points.pointsLoss} pts` : ""}
            </p>
          </div>

          <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto px-4">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold ${tab === t.key ? "bg-volt text-volt-fg" : "border border-line text-ink-muted"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "fixtures" && <FixtureList key={`${board.competition.id}-${board.rounds.length}`} rounds={board.rounds} onOpen={setOpen} />}
          {tab === "table" && <StandingsTables tables={board.tables} advance={board.groupStage?.advance} />}
          {tab === "bracket" && <BracketView rounds={board.bracket} champion={board.champion} onOpen={setOpen} />}
          {tab === "setup" && <SetupPanel board={board} seeds={data.entrySeeds} onDone={load} />}

          <ResultSheet fixture={open} canEdit={board.competition.status === "SCHEDULED"} liveScoring={data.liveScoring} onClose={() => setOpen(null)} onSaved={load} />
        </div>
      )}
    </div>
  );
}
