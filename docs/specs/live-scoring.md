# TRIQ Play — live scoring and game analytics for every sport

Status (2026-10-28): **scoring engines built and tested** (`src/lib/scoring/*`, 18 tests). **Database not applied**
(`prisma/sql/2026-10-28_live_scoring.sql`, awaiting founder approval). No screens yet.

## 1. One system, seven scoring families

Every match is a list of events (a ball, a goal, a point, a lap time). The sport's engine replays the events into the
live score and player stats. Corrections void an event (never delete) and replay, so scores are always auditable and
undo is safe. Each sport is just a configuration of its family.

| Family | Sports | Engine | Live score shows |
|---|---|---|---|
| Innings & overs | Cricket | `cricket.ts` | Runs/wickets, overs, this over, batting & bowling cards, run rate, target, required rate |
| Goals / points in periods | Football, futsal, hockey, handball, basketball, kabaddi | `goals.ts` | Score, period, scorers, assists, cards, timeline |
| Rally points & sets | Badminton, table tennis, volleyball, squash, pickleball | `rally.ts` | Set scores, current set, sets won |
| Tennis | Tennis | `tennis.ts` | Points (15/30/40, deuce, advantage), games, sets, tiebreak |
| Timed / measured | Swimming, athletics (track & field), skating, cycling | `performance.ts` | Rankings, marks, personal bests, DNS/DNF/DQ |
| Bouts & judged | Karate, taekwondo, wrestling, boxing (judo later) | `bout.ts` | Points, penalties, judges' cards, stoppages, point-gap wins |
| Board | Chess | `chess.ts` | Results, standings, academy Elo rating |

## 2. Plan per sport

| Sport | Format settings | Scorer taps | Athlete stats built over a season |
|---|---|---|---|
| **Cricket** | Overs per innings (T10/T20/custom), balls per over, wide/no-ball penalty | 0 1 2 3 4 6, Wide, No-ball, Bye, Leg-bye, Wicket (how out, fielder), change bowler, undo | Batting: matches, runs, balls, average, strike rate, 4s/6s, 50s/100s, best. Bowling: overs, wickets, economy, best figures. Catches |
| **Football / futsal** | 2 halves, minutes | Goal (scorer, assist), penalty, own goal, yellow/red card, sub, half start/end | Matches, goals, assists, cards; clean sheets for keepers (phase 3) |
| **Hockey** | 4 quarters | Field goal, penalty corner, penalty stroke, green/yellow/red card | Goals by type, cards |
| **Basketball** | 4 quarters | 2-pointer, 3-pointer, free throw, foul | Points, 3PM/2PM/FTM, fouls; points per game |
| **Kabaddi** | 2 halves | Raid touch, bonus, tackle, super tackle, all-out | Raid points, tackle points, super tackles |
| **Handball** | 2 halves | Goal, 7-metre goal, card | Goals, cards |
| **Badminton** | 21 points, win by 2, cap 30, best of 3 | Point to A / point to B (big buttons), undo | Matches, wins, sets won/lost, points won |
| **Table tennis** | 11 points, win by 2, best of 5 (configurable) | Same | Same |
| **Volleyball** | 25 points, deciding set 15, best of 5 | Same, per team | Team results; player points (phase 3) |
| **Squash / pickleball** | 11 points, win by 2 | Same | Same |
| **Tennis** | Best of 3, tiebreak at 6–6, optional no-ad | Point A / point B; engine calls deuce, games, sets | Matches, sets, games won |
| **Swimming** | Event list (50m free, 100m back...), heats | Enter times (mm:ss.cc) or DNS/DNF/DQ | Personal best per event, progression chart, ranks |
| **Athletics** | Track (time) and field (distance/height, best of attempts) | Time per runner; mark per attempt | PB per event, season best, progression |
| **Skating / cycling** | Timed events | Times | PB per event |
| **Karate / taekwondo / wrestling** | Rounds, point-gap win | Points by technique, penalty, stoppage | Bouts, wins, win method, points scored |
| **Boxing** | Rounds, 3 judges | Judges' cards per round, stoppage | Bouts, wins by KO/decision |
| **Chess** | Swiss/round robin (later) | Result 1-0 / ½-½ / 0-1 | Rating, W/D/L, standings |

Sports not listed use the closest family (e.g. throwball → rally, kho-kho → goals/points).

## 3. Screens

1. **Create match** (coach/admin): pick sport → format pre-filled from the table above → teams or athletes from batches
   (opposition by name) → optional link to a competition fixture or a batch match/event.
2. **Scorer console** (phone, landscape-friendly, one hand): the taps above as large buttons, the live score always
   visible, **Undo**, works offline (events queue on the phone with a client id and sync later — same pattern as
   attendance), two scorers can't overwrite each other (version check).
3. **Live match page** for parents: score, timeline, scorecard; opened from the app or a WhatsApp share link; refreshes
   every few seconds (realtime push later).
4. **Athlete profile → Stats** per sport (table above), season filter, progression charts for timed sports.
5. **Leaderboards**: per batch and academy (top run-scorers, wicket-takers, goal-scorers, fastest 50m...), opt-in for
   public sharing.
6. **Auto cards** (with photo/video phase): "Player of the match", "50 runs", "New PB 31.20s" — shareable images.

## 4. Who can do what

- Create/score: admins; coaches for their own batches; the fixture's `officialUserId` for competition fixtures.
- View: academy members by default (`ACADEMY`); `LINK` visibility gives a share link for parents/relatives.
- **Minors:** public/link pages show first name + last initial only, no photos, unless a guardian has consented
  (consent comes with the photo/video phase). Stats are never shown on public search pages without consent.
- Every correction is an audited void, never a delete.

## 5. Data (see SQL)

`LiveMatch` (sport, family, config, status, visibility, share token, cached state, version) ·
`LiveMatchPlayer` (lineups; academy athletes link to `Student`) · `LiveMatchEvent` (append-only, voidable, client id for
offline idempotency) · `AthleteMatchStat` (per-athlete stats written when a match completes) · `PerformanceResult`
(times/distances, personal-best flag). All with `orgId` and RLS on. Links to existing `Fixture` and `Event` so
competitions and RSVP keep working.

## 6. Phases

1. **Approve and apply the SQL**, add Prisma models, server actions (create match, add/void event with permission and
   version checks, complete match → write `AthleteMatchStat`).
2. **Scorer consoles** in this order: badminton/table tennis (simplest, proves the flow) → cricket → football family →
   timed events → tennis → bouts → chess.
3. **Live page + share link**, athlete stats tab, leaderboards.
4. **Photos/videos** (separate plan: hosting choice, guardian consent, moderation) and auto cards.
5. Realtime push, tournament live dashboards, video clips attached to match events.

## 7. Open decisions

- Approve the five tables (additive; nothing existing changes).
- Default visibility for match pages: `ACADEMY` (recommended) or `LINK`.
- Which sports to ship first beyond the order above.
