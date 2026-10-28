/** Chess — game results and an academy Elo ladder. Pure. */
export type ChessResult = "1-0" | "0-1" | "1/2-1/2";

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** New ratings after one game. K=40 for juniors/new players is common; 20 otherwise. */
export function eloUpdate(white: number, black: number, result: ChessResult, k = 20): { white: number; black: number } {
  const sWhite = result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5;
  const eWhite = expectedScore(white, black);
  const delta = k * (sWhite - eWhite);
  return { white: Math.round(white + delta), black: Math.round(black - delta) };
}

export type StandingRow = { player: string; played: number; points: number; wins: number; draws: number; losses: number };

export function chessStandings(games: ReadonlyArray<{ white: string; black: string; result: ChessResult }>): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const row = (p: string) => rows.get(p) ?? (rows.set(p, { player: p, played: 0, points: 0, wins: 0, draws: 0, losses: 0 }), rows.get(p)!);
  for (const g of games) {
    const w = row(g.white);
    const b = row(g.black);
    w.played++;
    b.played++;
    if (g.result === "1-0") {
      w.points += 1;
      w.wins++;
      b.losses++;
    } else if (g.result === "0-1") {
      b.points += 1;
      b.wins++;
      w.losses++;
    } else {
      w.points += 0.5;
      b.points += 0.5;
      w.draws++;
      b.draws++;
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.player.localeCompare(b.player));
}
