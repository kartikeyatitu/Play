// The fixture score a finished live match produces. Pure, so it can be tested without a database.
import { boutTotals, liveOutcome, type CricketLiveConfig, type LiveConfig, type LiveSide, type LiveState } from "@/lib/live-match";

export type LiveFixtureScore = { homeScore: number; awayScore: number; outcome: LiveSide | "draw" };

/**
 * Home/away scores in the unit a results table expects (goals, sets, runs, points, chess points),
 * plus who won. Null when the match produced no decision (unfinished, single innings, athletics).
 */
export function fixtureScoreFromLive(state: LiveState, config: LiveConfig): LiveFixtureScore | null {
  const raw = rawScore(state, config);
  if (!raw) return null;
  // A results table decides the winner from the scores, so they must agree with the live outcome.
  // A bout won by stoppage while behind on points is recorded 1–0 to the winner.
  const agrees =
    raw.outcome === "draw" ? raw.homeScore === raw.awayScore : raw.outcome === "home" ? raw.homeScore > raw.awayScore : raw.awayScore > raw.homeScore;
  if (agrees) return raw;
  if (raw.outcome === "draw") return null;
  return raw.outcome === "home" ? { homeScore: 1, awayScore: 0, outcome: "home" } : { homeScore: 0, awayScore: 1, outcome: "away" };
}

function rawScore(state: LiveState, config: LiveConfig): LiveFixtureScore | null {
  const battingFirst: LiveSide = (config as CricketLiveConfig).battingFirst ?? "home";
  const outcome = liveOutcome(state, battingFirst);
  if (!outcome) return null;
  switch (state.family) {
    case "goals":
      return { homeScore: state.goals.score.home, awayScore: state.goals.score.away, outcome };
    case "rally":
      return { homeScore: state.rally.setsWon.home, awayScore: state.rally.setsWon.away, outcome };
    case "tennis":
      return { homeScore: state.tennis.setsWon.home, awayScore: state.tennis.setsWon.away, outcome };
    case "cricket": {
      const [a, b] = state.cricket.innings;
      const first = a?.runs ?? 0;
      const second = b?.runs ?? 0;
      return battingFirst === "home" ? { homeScore: first, awayScore: second, outcome } : { homeScore: second, awayScore: first, outcome };
    }
    case "bout": {
      const t = boutTotals(state.bout);
      return { homeScore: t.home, awayScore: t.away, outcome };
    }
    case "chess":
      return outcome === "draw" ? { homeScore: 1, awayScore: 1, outcome } : outcome === "home" ? { homeScore: 1, awayScore: 0, outcome } : { homeScore: 0, awayScore: 1, outcome };
    case "performance":
      return null;
  }
}
