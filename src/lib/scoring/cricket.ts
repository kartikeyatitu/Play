/**
 * Cricket scoring engine — pure. Replays an append-only list of ball events into the live score,
 * batting and bowling cards, run rates and the result. Undo = remove/void the last event and replay.
 *
 * Rules implemented (standard limited-overs):
 *  - Wides and no-balls are not legal deliveries (the over doesn't advance) and add 1 penalty run (configurable).
 *  - Wide: all runs are extras; no-ball: off-bat runs go to the batter, the penalty is an extra and counts against the bowler.
 *  - Byes / leg byes: legal deliveries, runs are extras and don't count against the bowler.
 *  - Strike rotates on odd runs actually run (bat runs, byes, leg byes, wide/no-ball runs beyond the penalty) and at over end.
 *  - Bowler's wicket: not for run out, retired, obstructing; run out is credited to the fielder only.
 *  - An innings ends at its over limit, when all out, or (2nd innings) when the target is passed.
 */

export type ExtraKind = "wide" | "noball" | "bye" | "legbye";
export type WicketKind = "bowled" | "caught" | "lbw" | "stumped" | "runout" | "hitwicket" | "retired" | "obstructing";

export type CricketBall = {
  type: "ball";
  striker: string;
  nonStriker: string;
  bowler: string;
  /** Runs off the bat (or run on a no-ball). */
  runs: number;
  extra?: { kind: ExtraKind; runs?: number }; // runs = runs run on the extra (byes/leg byes/wides beyond the penalty)
  wicket?: { kind: WicketKind; playerOut: string; fielder?: string };
};
export type CricketEndInnings = { type: "end_innings"; reason?: "declared" | "abandoned" };
export type CricketEvent = CricketBall | CricketEndInnings;

export type CricketConfig = { oversPerInnings: number; ballsPerOver?: number; wicketsPerInnings?: number; extraPenalty?: number; innings?: number };

export type BatterCard = { player: string; runs: number; balls: number; fours: number; sixes: number; out: string | null };
export type BowlerCard = { player: string; balls: number; maidens: number; runs: number; wickets: number; wides: number; noballs: number };
export type InningsState = {
  number: number;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: { wides: number; noballs: number; byes: number; legbyes: number; total: number };
  batting: BatterCard[];
  bowling: BowlerCard[];
  striker: string | null;
  nonStriker: string | null;
  lastBowler: string | null;
  complete: boolean;
  thisOver: string[]; // display symbols for the current over: "1", "4", "W", "wd", "nb+4"
  /** Runs scored in each over (index 0 = first over), including the over in progress. */
  overRuns: number[];
  /** Fall of wickets: score, wicket number and overs when each wicket fell. */
  fow: { runs: number; wicket: number; player: string; overs: string }[];
  /** Current partnership. */
  partnership: { runs: number; balls: number };
};
export type CricketState = {
  innings: InningsState[];
  current: number; // index of the innings in play
  target: number | null;
  result: string | null;
};

const LEGAL_BREAKERS: WicketKind[] = ["runout", "retired", "obstructing"];

export function oversText(legalBalls: number, ballsPerOver = 6): string {
  return `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
}

export function runRate(runs: number, legalBalls: number, ballsPerOver = 6): number | null {
  return legalBalls > 0 ? (runs * ballsPerOver) / legalBalls : null;
}

function newInnings(number: number): InningsState {
  return {
    number,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 },
    batting: [],
    bowling: [],
    striker: null,
    nonStriker: null,
    lastBowler: null,
    complete: false,
    thisOver: [],
    overRuns: [],
    fow: [],
    partnership: { runs: 0, balls: 0 },
  };
}

function bat(inn: InningsState, player: string): BatterCard {
  let b = inn.batting.find((x) => x.player === player);
  if (!b) {
    b = { player, runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
    inn.batting.push(b);
  }
  return b;
}
function bowl(inn: InningsState, player: string): BowlerCard {
  let b = inn.bowling.find((x) => x.player === player);
  if (!b) {
    b = { player, balls: 0, maidens: 0, runs: 0, wickets: 0, wides: 0, noballs: 0 };
    inn.bowling.push(b);
  }
  return b;
}

export function scoreCricket(events: ReadonlyArray<CricketEvent>, config: CricketConfig): CricketState {
  const bpo = config.ballsPerOver ?? 6;
  const maxWkts = config.wicketsPerInnings ?? 10;
  const penalty = config.extraPenalty ?? 1;
  const totalInnings = config.innings ?? 2;
  const state: CricketState = { innings: [newInnings(1)], current: 0, target: null, result: null };
  let overRunsByBowler = 0; // for maidens

  const closeInnings = () => {
    const inn = state.innings[state.current];
    inn.complete = true;
    if (state.current === 0 && totalInnings >= 2) {
      state.target = inn.runs + 1;
      state.innings.push(newInnings(2));
      state.current = 1;
      overRunsByBowler = 0;
    } else {
      finish();
    }
  };
  const finish = () => {
    if (state.innings.length < 2) {
      state.result = "Innings complete";
      return;
    }
    const [a, b] = state.innings;
    if (b.runs > a.runs) state.result = `Team batting second won by ${maxWkts - b.wickets} wicket${maxWkts - b.wickets === 1 ? "" : "s"}`;
    else if (b.runs < a.runs) state.result = `Team batting first won by ${a.runs - b.runs} run${a.runs - b.runs === 1 ? "" : "s"}`;
    else state.result = "Match tied";
  };

  for (const ev of events) {
    if (state.result) break;
    const inn = state.innings[state.current];
    if (ev.type === "end_innings") {
      closeInnings();
      continue;
    }
    const kind = ev.extra?.kind;
    const extraRuns = Math.max(0, ev.extra?.runs ?? 0);
    const batRuns = Math.max(0, ev.runs || 0);
    const legal = kind !== "wide" && kind !== "noball";
    inn.striker = ev.striker;
    inn.nonStriker = ev.nonStriker;
    const striker = bat(inn, ev.striker);
    bat(inn, ev.nonStriker);
    const bowler = bowl(inn, ev.bowler);
    if (inn.lastBowler !== ev.bowler && inn.legalBalls % bpo === 0) {
      overRunsByBowler = 0;
      inn.thisOver = [];
    }
    inn.lastBowler = ev.bowler;

    let total = 0;
    let symbol = "";
    if (kind === "wide") {
      const r = penalty + extraRuns;
      inn.extras.wides += r;
      bowler.wides += r;
      bowler.runs += r;
      total = r;
      symbol = extraRuns > 0 ? `wd+${extraRuns}` : "wd";
    } else if (kind === "noball") {
      inn.extras.noballs += penalty;
      bowler.noballs += penalty;
      bowler.runs += penalty + batRuns;
      striker.runs += batRuns;
      striker.balls += 1; // a no-ball counts as a ball faced
      if (batRuns === 4) striker.fours++;
      if (batRuns === 6) striker.sixes++;
      total = penalty + batRuns;
      symbol = batRuns > 0 ? `nb+${batRuns}` : "nb";
    } else if (kind === "bye" || kind === "legbye") {
      if (kind === "bye") inn.extras.byes += extraRuns;
      else inn.extras.legbyes += extraRuns;
      striker.balls += 1;
      total = extraRuns;
      symbol = `${extraRuns}${kind === "bye" ? "b" : "lb"}`;
    } else {
      striker.runs += batRuns;
      striker.balls += 1;
      bowler.runs += batRuns;
      if (batRuns === 4) striker.fours++;
      if (batRuns === 6) striker.sixes++;
      total = batRuns;
      symbol = String(batRuns);
    }
    inn.extras.total = inn.extras.wides + inn.extras.noballs + inn.extras.byes + inn.extras.legbyes;
    inn.runs += total;
    const overIndex = Math.floor(inn.legalBalls / bpo);
    while (inn.overRuns.length <= overIndex) inn.overRuns.push(0);
    inn.overRuns[overIndex] += total;
    inn.partnership.runs += total;
    if (legal) inn.partnership.balls += 1;
    overRunsByBowler += kind === "bye" || kind === "legbye" ? 0 : total;

    if (ev.wicket) {
      inn.wickets++;
      const out = bat(inn, ev.wicket.playerOut);
      out.out = ev.wicket.kind === "caught" && ev.wicket.fielder ? `c ${ev.wicket.fielder} b ${ev.bowler}` : ev.wicket.kind === "runout" ? `run out${ev.wicket.fielder ? ` (${ev.wicket.fielder})` : ""}` : ev.wicket.kind === "retired" ? "retired" : `${ev.wicket.kind} b ${ev.bowler}`;
      if (!LEGAL_BREAKERS.includes(ev.wicket.kind)) bowler.wickets++;
      inn.fow.push({ runs: inn.runs, wicket: inn.wickets, player: ev.wicket.playerOut, overs: oversText(inn.legalBalls + (legal ? 1 : 0), bpo) });
      inn.partnership = { runs: 0, balls: 0 };
      symbol = symbol === "0" ? "W" : `${symbol}W`;
      if (ev.wicket.playerOut === inn.striker) inn.striker = null;
      else if (ev.wicket.playerOut === inn.nonStriker) inn.nonStriker = null;
    }

    if (legal) {
      inn.legalBalls++;
      bowler.balls++;
    }
    inn.thisOver.push(symbol);

    // Strike rotation: odd runs actually run.
    const ran = kind === "wide" ? extraRuns : kind === "noball" ? batRuns : kind === "bye" || kind === "legbye" ? extraRuns : batRuns;
    const boundary = !kind && (batRuns === 4 || batRuns === 6);
    if (ran % 2 === 1 && !boundary && inn.striker && inn.nonStriker) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
    if (legal && inn.legalBalls % bpo === 0) {
      if (overRunsByBowler === 0) bowler.maidens++;
      if (inn.striker && inn.nonStriker) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
    }

    const allOut = inn.wickets >= maxWkts;
    const oversDone = inn.legalBalls >= config.oversPerInnings * bpo;
    const chased = state.target != null && state.current === 1 && inn.runs >= state.target;
    if (chased) {
      inn.complete = true;
      finish();
    } else if (allOut || oversDone) {
      closeInnings();
    }
  }
  return state;
}

export function requiredRunRate(state: CricketState, config: CricketConfig): number | null {
  if (state.target == null || state.current !== 1) return null;
  const inn = state.innings[1];
  const bpo = config.ballsPerOver ?? 6;
  const ballsLeft = config.oversPerInnings * bpo - inn.legalBalls;
  const need = state.target - inn.runs;
  return ballsLeft > 0 && need > 0 ? (need * bpo) / ballsLeft : null;
}
