import type { BoardTable } from "@/lib/competition/board";
import { card } from "./styles";

/** League or group tables. Names are already safe for display (no children's full names). */
export function StandingsTables({ tables, advance }: { tables: BoardTable[]; advance?: number }) {
  if (tables.length === 0) return <p className="text-sm text-ink-muted">The table appears once the draw is made.</p>;
  return (
    <div className="space-y-4">
      {tables.map((t) => (
        <section key={t.label} className={`${card} p-0 overflow-hidden`}>
          <h3 className="px-4 pt-3 pb-2 text-sm font-semibold text-ink">{t.label}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="w-8 py-2 pl-4 text-left font-semibold">#</th>
                  <th className="py-2 text-left font-semibold">Entry</th>
                  <th className="px-1.5 py-2 text-right font-semibold">P</th>
                  <th className="px-1.5 py-2 text-right font-semibold">W</th>
                  <th className="px-1.5 py-2 text-right font-semibold">D</th>
                  <th className="px-1.5 py-2 text-right font-semibold">L</th>
                  <th className="hidden px-1.5 py-2 text-right font-semibold sm:table-cell">F</th>
                  <th className="hidden px-1.5 py-2 text-right font-semibold sm:table-cell">A</th>
                  <th className="px-1.5 py-2 text-right font-semibold">+/−</th>
                  <th className="py-2 pl-1.5 pr-4 text-right font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {t.rows.map((r) => {
                  const through = advance !== undefined && r.position <= advance;
                  return (
                    <tr key={r.entryId} className={through ? "bg-volt/10" : undefined}>
                      <td className="py-2.5 pl-4 text-ink-subtle">{r.position}</td>
                      <td className="max-w-[9rem] truncate py-2.5 font-medium text-ink sm:max-w-none">{r.name}</td>
                      <td className="px-1.5 py-2.5 text-right text-ink-muted">{r.played}</td>
                      <td className="px-1.5 py-2.5 text-right text-ink-muted">{r.won}</td>
                      <td className="px-1.5 py-2.5 text-right text-ink-muted">{r.drawn}</td>
                      <td className="px-1.5 py-2.5 text-right text-ink-muted">{r.lost}</td>
                      <td className="hidden px-1.5 py-2.5 text-right text-ink-muted sm:table-cell">{r.for}</td>
                      <td className="hidden px-1.5 py-2.5 text-right text-ink-muted sm:table-cell">{r.against}</td>
                      <td className="px-1.5 py-2.5 text-right text-ink-muted">{r.difference > 0 ? `+${r.difference}` : r.difference}</td>
                      <td className="py-2.5 pl-1.5 pr-4 text-right font-bold text-ink">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-ink-subtle">
        Order: points, score difference, scores for, then head-to-head between the entries still level.
        {advance !== undefined ? ` Highlighted rows go through to the knockout.` : ""}
      </p>
    </div>
  );
}
