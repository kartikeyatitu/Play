/**
 * TRIQ Body: built-in drill library. A plain TypeScript constant, so it can be read with no database.
 * Descriptions are TRIQ's own. Academy custom drills live in the Drill table (flag drillLibrary).
 */

export const DRILL_SPORTS = [
  { key: "cricket", label: "Cricket" },
  { key: "football", label: "Football" },
  { key: "badminton", label: "Badminton" },
  { key: "tennis", label: "Tennis" },
  { key: "basketball", label: "Basketball" },
  { key: "swimming", label: "Swimming" },
  { key: "athletics", label: "Athletics" },
  { key: "hockey", label: "Hockey" },
  { key: "kabaddi", label: "Kabaddi" },
  { key: "table_tennis", label: "Table tennis" },
  { key: "volleyball", label: "Volleyball" },
  { key: "karate", label: "Karate" },
  { key: "chess", label: "Chess" },
] as const;

export type DrillSport = (typeof DRILL_SPORTS)[number]["key"];

export const DRILL_AGE_GROUPS = ["All ages", "U8+", "U10+", "U12+", "U14+", "U16+"] as const;
export type DrillAgeGroup = (typeof DRILL_AGE_GROUPS)[number];

export const DRILL_FOCUS = [
  "warm-up",
  "technique",
  "footwork",
  "speed",
  "agility",
  "conditioning",
  "strength",
  "decision-making",
  "teamwork",
  "tactics",
  "cool-down",
] as const;
export type DrillFocus = (typeof DRILL_FOCUS)[number];

export type LibraryDrill = {
  key: string;
  sport: DrillSport;
  title: string;
  description: string;
  durationMin: number;
  equipment: string[];
  ageGroup: DrillAgeGroup;
  focus: DrillFocus[];
};

function d(
  sport: DrillSport,
  slug: string,
  title: string,
  durationMin: number,
  ageGroup: DrillAgeGroup,
  focus: DrillFocus[],
  equipment: string[],
  description: string,
): LibraryDrill {
  return { key: `${sport}.${slug}`, sport, title, description, durationMin, equipment, ageGroup, focus };
}

export const DRILLS: readonly LibraryDrill[] = [
  // ---- Cricket
  d("cricket", "cone-throw", "Cone target throwing", 15, "U8+", ["technique"], ["Tennis or cricket balls", "Cones", "Stumps"],
    "Players pair up 15 m apart and throw flat at a single stump or cone. Score one point for a hit. Move back 2 m after every three hits to build arm strength and accuracy."),
  d("cricket", "drop-ball-batting", "Drop-ball front-foot drive", 15, "U10+", ["technique"], ["Bat", "Tennis balls", "Helmet if hard ball"],
    "A partner drops a ball from shoulder height just in front of the batter's front foot. The batter steps in and drives along the ground with a high front elbow. Ten balls each, then swap."),
  d("cricket", "run-two", "Running between wickets: turn for two", 10, "U10+", ["speed", "decision-making"], ["Bats", "Stumps"],
    "Pairs run twos with the bat, grounding it over the crease and turning on the non-dominant side as often as the dominant one. The non-striker calls each run loudly. Time sets of three runs."),
  d("cricket", "short-catch", "Reaction slip catching", 12, "U12+", ["technique", "agility"], ["Soft balls", "Rebound net or bat"],
    "A feeder edges or rebounds soft balls towards three fielders in a slip line. Fielders start with weight on the balls of the feet and soft hands. Rotate positions every ten balls."),
  d("cricket", "bowling-lanes", "Bowling into a channel", 20, "U10+", ["technique"], ["Balls", "Cones", "Stumps"],
    "Mark a channel with cones from a good length to the off stump. Bowlers bowl overs of six aiming to land in the channel; count how many land. Focus on a straight run-up and a smooth action, not pace."),

  // ---- Football
  d("football", "rondo-4v1", "Rondo 4 v 1", 12, "U10+", ["technique", "decision-making"], ["Ball", "Cones"],
    "Four players keep the ball in a 10 m square from one defender. Two-touch limit. The player who loses the ball becomes the defender. Encourages body shape open to the next pass."),
  d("football", "gate-dribble", "Gate dribbling", 10, "U8+", ["technique", "agility"], ["Balls", "Cones"],
    "Scatter small cone gates across an area. Each player dribbles through as many gates as possible in 60 seconds, using both feet and changing direction after every gate."),
  d("football", "passing-pairs", "Passing and receiving on the half-turn", 12, "U10+", ["technique"], ["Balls", "Cones"],
    "Pairs 10 m apart. Receive across the body with the back foot, turn and pass back with the other foot. Progress to one-touch and longer distances."),
  d("football", "1v1-channel", "1 v 1 to a line", 15, "U10+", ["decision-making", "speed"], ["Balls", "Cones", "Bibs"],
    "In a 10 m by 20 m channel the attacker tries to dribble over the end line while the defender tries to win the ball. Short rounds of 20 seconds with full rest."),
  d("football", "small-sided-3v3", "3 v 3 small-sided game", 20, "U8+", ["teamwork", "tactics"], ["Balls", "Bibs", "Mini goals"],
    "Play 3 v 3 on a small pitch with mini goals and no keepers. Many touches for every player. Rotate teams every four minutes."),

  // ---- Badminton
  d("badminton", "shadow-corners", "Six-corner shadow footwork", 10, "U10+", ["footwork", "conditioning"], ["Court", "Cones"],
    "From the base position, the player moves to each corner the coach points to, plays a shadow shot and returns to base. Sets of 30 seconds with 30 seconds rest."),
  d("badminton", "high-serve", "High serve to the back line", 12, "U10+", ["technique"], ["Shuttles", "Racquets"],
    "Players serve high to the back of the doubles-singles zone. A target hoop near the back line scores two points. Focus on a relaxed swing and a full follow-through."),
  d("badminton", "net-kills", "Net play and kills", 12, "U12+", ["technique", "speed"], ["Shuttles", "Racquets"],
    "The feeder lifts shuttles just over the net; the player keeps the racquet up and kills or tumbles at the net. Ten feeds, then rotate."),
  d("badminton", "clear-drop", "Clear and drop rally", 15, "U12+", ["technique", "tactics"], ["Shuttles", "Racquets"],
    "Pairs rally with a fixed pattern: clear, clear, drop, lift. Keep the rally going as long as possible, then switch who drops."),
  d("badminton", "multi-shuttle", "Multi-shuttle feeding", 10, "U14+", ["footwork", "conditioning"], ["Shuttle tube", "Racquets"],
    "A coach hand-feeds shuttles quickly to all corners. The player plays each one and returns to base. Rounds of 15 shuttles with full rest."),

  // ---- Tennis
  d("tennis", "mini-tennis", "Mini tennis in the service boxes", 10, "U8+", ["technique", "warm-up"], ["Racquets", "Soft balls"],
    "Players rally gently inside the service boxes with soft balls. Focus on a full turn and contact in front of the body. Count the longest rally."),
  d("tennis", "crosscourt-rally", "Cross-court consistency", 15, "U10+", ["technique", "tactics"], ["Racquets", "Balls"],
    "Rally cross-court only, forehand to forehand and then backhand to backhand. Aim for ten-shot rallies with good depth past the service line."),
  d("tennis", "serve-targets", "Serve to targets", 15, "U12+", ["technique"], ["Balls", "Cones or targets"],
    "Place targets in the corners of each service box. Serve ten balls to each side and count hits. Work on a steady toss before adding pace."),
  d("tennis", "spider-run", "Spider run", 8, "U12+", ["agility", "conditioning"], ["Balls", "Racquet"],
    "Put five balls on the singles and service lines. Starting from the centre mark, run to each ball and bring it back one at a time. Time it and rest fully between runs."),
  d("tennis", "approach-volley", "Approach and volley", 15, "U12+", ["technique", "decision-making"], ["Racquets", "Balls"],
    "The feeder sends a short ball; the player approaches down the line, split-steps and volleys the next ball into the open court."),

  // ---- Basketball
  d("basketball", "stationary-dribble", "Stationary ball-handling series", 10, "U8+", ["technique", "warm-up"], ["Basketballs"],
    "Pound dribbles, crossovers, between the legs and behind the back, 30 seconds each, eyes up. Count fingers the coach holds up to keep the head up."),
  d("basketball", "form-shooting", "Form shooting close to the basket", 12, "U8+", ["technique"], ["Basketballs", "Hoop"],
    "Start one step from the rim. One-hand shots with the elbow under the ball and a high finish. Move back a step after five makes."),
  d("basketball", "layup-lines", "Two-line layups", 12, "U10+", ["technique", "warm-up"], ["Basketballs", "Hoop"],
    "One line drives for a layup, the other rebounds and passes out. Switch lines after each go, and switch sides of the basket to use both hands."),
  d("basketball", "defensive-slides", "Defensive slides", 8, "U10+", ["footwork", "conditioning"], ["Cones"],
    "Slide in a low stance between cones without crossing the feet. Add a drop step on the coach's call. Sets of 20 seconds."),
  d("basketball", "3v2-break", "3 v 2 fast break", 15, "U12+", ["decision-making", "teamwork"], ["Basketballs", "Bibs"],
    "Three attackers push the ball up the court against two defenders. Look for the open player and finish quickly. The two defenders become attackers going the other way."),

  // ---- Swimming
  d("swimming", "kick-board", "Kick with a board", 10, "U8+", ["technique", "conditioning"], ["Kickboards", "Pool"],
    "Lengths of flutter kick holding a board, kicking from the hips with relaxed ankles. Add fins for younger or newer swimmers. Rest at each wall."),
  d("swimming", "catch-up-freestyle", "Catch-up freestyle", 12, "U10+", ["technique"], ["Pool"],
    "Freestyle where one hand waits in front until the other hand touches it. Builds a long stroke and good timing. Four lengths with rest."),
  d("swimming", "streamline-pushoff", "Streamline push-offs", 8, "U8+", ["technique"], ["Pool"],
    "Push off the wall in a tight streamline, arms squeezed over the ears, and glide as far as possible. Measure in body lengths."),
  d("swimming", "bilateral-breathing", "Breathing every three strokes", 12, "U10+", ["technique"], ["Pool"],
    "Freestyle breathing every third stroke so the swimmer breathes to both sides. Keep one goggle in the water when turning to breathe."),
  d("swimming", "pace-25s", "Paced 25s", 15, "U12+", ["conditioning"], ["Pool", "Pace clock"],
    "Swim 8 × 25 m on a set time, aiming to hold the same time each one. Lower intensity for younger swimmers."),

  // ---- Athletics
  d("athletics", "a-skips", "A-skips and running drills", 10, "U8+", ["warm-up", "technique"], ["Cones"],
    "Over 20 m: marching, A-skips, high knees and heel flicks. Tall posture, quick ground contact and active arms."),
  d("athletics", "block-starts", "Reaction starts", 12, "U10+", ["speed"], ["Cones", "Whistle or clap"],
    "From a standing or crouch start, react to a clap and drive out for 10 m. Vary the delay before the clap. Full rest between starts."),
  d("athletics", "hurdle-walkovers", "Mini hurdle walk-overs", 10, "U8+", ["technique", "footwork"], ["Mini hurdles"],
    "Walk and then skip over a line of low hurdles, driving the knee up and stepping down quickly. Leads into hurdle rhythm later."),
  d("athletics", "relay-handover", "Relay baton handover", 15, "U10+", ["teamwork", "technique"], ["Batons", "Cones"],
    "In pairs, practise an upsweep handover inside a marked zone. The incoming runner calls 'hand' and the outgoing runner reaches back without looking."),
  d("athletics", "standing-throws", "Medicine ball throws", 12, "U12+", ["strength", "technique"], ["Light medicine balls"],
    "Chest pass and overhead throws forward from standing, using the legs to start the movement. Light balls only, with technique before distance."),

  // ---- Hockey
  d("hockey", "indian-dribble", "Indian dribble through cones", 10, "U8+", ["technique"], ["Sticks", "Balls", "Cones"],
    "Move the ball side to side with the stick, turning the stick over the ball, through a line of cones. Keep the ball close and the head up."),
  d("hockey", "push-pass", "Push pass in pairs", 12, "U8+", ["technique"], ["Sticks", "Balls"],
    "Pairs 10 m apart push-pass along the ground with the ball kept close to the stick. Receive on the open side, stop it and pass back."),
  d("hockey", "reverse-receive", "Receiving on the reverse", 12, "U12+", ["technique"], ["Sticks", "Balls", "Cones"],
    "The feeder passes to the receiver's left side. The receiver stops it on the reverse stick and moves away in one smooth action."),
  d("hockey", "2v1-circle", "2 v 1 into the circle", 15, "U12+", ["decision-making", "tactics"], ["Sticks", "Balls", "Goal", "Bibs"],
    "Two attackers against one defender from the top of the circle. Draw the defender, then pass or shoot. Keeper optional with full kit."),
  d("hockey", "shuttle-dribble", "Dribble shuttle relay", 10, "U10+", ["speed", "conditioning"], ["Sticks", "Balls", "Cones"],
    "Teams dribble out to a cone 15 m away, around it and back, handing over to the next player. Keep the ball under control at speed."),

  // ---- Kabaddi
  d("kabaddi", "chant-breath", "Chant and breath control", 8, "U10+", ["technique", "conditioning"], ["Mat or court"],
    "Practise saying 'kabaddi' continuously in one breath while moving across the court. Gradually extend the time to the 30-second raid limit."),
  d("kabaddi", "toe-touch", "Toe touch raids", 12, "U10+", ["technique", "agility"], ["Mat or court"],
    "A raider tries a quick toe touch on a defender standing in position, then returns to the midline. Work on balance and a fast retreat."),
  d("kabaddi", "chain-tackle", "Chain tackle", 15, "U14+", ["teamwork", "technique"], ["Mat"],
    "Pairs of defenders hold hands and practise closing together on a walking raider, then at speed. On mats only, with tackles below the chest and controlled landings."),
  d("kabaddi", "bonus-line", "Bonus line reach", 10, "U12+", ["footwork", "agility"], ["Mat or court"],
    "The raider steps across the bonus line with one foot while the other foot stays in the air, then gets back to the midline before a defender tags."),
  d("kabaddi", "tag-game", "Kabaddi tag game", 12, "U8+", ["agility", "warm-up"], ["Cones"],
    "A simple tag game in a marked area where the chaser must keep saying 'kabaddi'. Gets young players used to moving while chanting, with no tackling."),

  // ---- Table tennis
  d("table_tennis", "forehand-counter", "Forehand counter-hit", 10, "U8+", ["technique", "warm-up"], ["Table", "Bats", "Balls"],
    "Rally forehand to forehand diagonally at a steady pace. Short, relaxed stroke closing towards the opposite shoulder."),
  d("table_tennis", "backhand-push", "Backhand push", 10, "U10+", ["technique"], ["Table", "Bats", "Balls"],
    "Rally backhand pushes low over the net with a slightly open bat. Keep the ball short and low."),
  d("table_tennis", "falkenberg", "Falkenberg footwork", 12, "U12+", ["footwork"], ["Table", "Bats", "Balls"],
    "A three-ball pattern: backhand, forehand from the backhand corner, then forehand from the forehand corner. Repeat to build quick side steps."),
  d("table_tennis", "serve-practice", "Short serve practice", 12, "U10+", ["technique"], ["Table", "Bats", "Balls", "Targets"],
    "Serve short so the ball would bounce twice on the other side. Place a small target near the net and count hits out of twenty."),
  d("table_tennis", "multi-ball", "Multi-ball feeding", 10, "U12+", ["footwork", "conditioning"], ["Table", "Bats", "Bucket of balls"],
    "The coach feeds balls quickly from a bucket to set positions or at random. Short sets of 20 balls with rest."),

  // ---- Volleyball
  d("volleyball", "forearm-pass", "Forearm pass to a target", 12, "U10+", ["technique"], ["Volleyballs", "Hoop or target"],
    "A partner tosses; the player passes with a flat platform to a target near the net. Legs do the work, arms stay still."),
  d("volleyball", "setting-pairs", "Setting in pairs", 10, "U10+", ["technique"], ["Volleyballs"],
    "Pairs set back and forth with hands shaped above the forehead. Progress to setting to self and then back to the partner."),
  d("volleyball", "underarm-serve", "Serve to zones", 12, "U10+", ["technique"], ["Volleyballs", "Net", "Cones"],
    "Serve underarm or overarm into numbered zones on the far court. Players call the zone before serving."),
  d("volleyball", "approach-jump", "Attack approach footwork", 10, "U12+", ["footwork", "technique"], ["Net", "Volleyballs"],
    "Practise the three- or four-step approach and a two-foot take-off without the ball, then add a self-toss and hit into the far court."),
  d("volleyball", "queen-of-court", "Queen of the court", 20, "U12+", ["teamwork", "tactics"], ["Volleyballs", "Net"],
    "Pairs or threes play short rallies. The winning side stays on the 'queen' side and challengers rotate in. Keeps everyone playing."),

  // ---- Karate
  d("karate", "stance-transitions", "Stance transitions", 10, "U8+", ["technique", "footwork"], ["Mats"],
    "Move up and down the dojo between front stance, back stance and horse stance on a count. Correct knee and foot alignment."),
  d("karate", "kihon-punches", "Kihon punch lines", 12, "U8+", ["technique"], ["Mats"],
    "Lines move forward with stepping punches on the count, focusing on hip rotation, the pulling hand and a clear kiai."),
  d("karate", "kicking-pads", "Front kick on pads", 12, "U10+", ["technique", "strength"], ["Kick pads"],
    "A partner holds a pad at waist height. Chamber the knee, snap the kick and pull back. Ten kicks each leg, then swap."),
  d("karate", "kata-sections", "Kata in sections", 15, "U10+", ["technique"], ["Mats"],
    "Break the current kata into short sections. Practise each section slowly, then at speed, then join them."),
  d("karate", "distance-game", "Distance and reaction game", 10, "U12+", ["agility", "decision-making"], ["Mats"],
    "Partners face each other at kicking distance. One steps in or out; the other keeps the same distance. No contact. Switch leader every 30 seconds."),

  // ---- Chess
  d("chess", "checkmate-patterns", "Checkmate patterns", 20, "U8+", ["technique", "tactics"], ["Boards", "Puzzle sheets"],
    "Solve a set of one-move checkmates from common patterns: back rank, ladder, queen and king. Players explain why each move is mate."),
  d("chess", "pawn-game", "Pawn war", 15, "U8+", ["tactics"], ["Boards"],
    "Play with only kings and pawns. The first to promote a pawn wins. Teaches pawn structure, breakthroughs and counting."),
  d("chess", "tactic-sprint", "Tactics sprint", 15, "U10+", ["tactics", "decision-making"], ["Puzzle sheets or tablets", "Timer"],
    "Solve as many forks, pins and skewers as possible in ten minutes. Then review the missed ones together."),
  d("chess", "opening-principles", "Opening principles walk-through", 20, "U10+", ["tactics"], ["Demo board", "Boards"],
    "Play the first ten moves of games following three rules: control the centre, develop pieces, castle early. Discuss moves that break a rule."),
  d("chess", "endgame-king-rook", "King and rook against king", 20, "U12+", ["technique"], ["Boards", "Clocks"],
    "Practise forcing checkmate with king and rook against king, using the box method. Play it against a partner with a clock."),
];

const DRILL_BY_KEY = new Map(DRILLS.map((x) => [x.key, x]));

export function getLibraryDrill(key: string | null | undefined): LibraryDrill | null {
  return key ? DRILL_BY_KEY.get(key) ?? null : null;
}

/** Normalise free-text sport names ("Table Tennis", "table-tennis") to a library key, or null. */
export function sportKey(raw: string | null | undefined): DrillSport | null {
  if (!raw) return null;
  const k = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
  const alias: Record<string, DrillSport> = { soccer: "football", tt: "table_tennis", ping_pong: "table_tennis", track_and_field: "athletics" };
  const key = alias[k] ?? k;
  return DRILL_SPORTS.some((s) => s.key === key) ? (key as DrillSport) : null;
}

export function sportLabel(key: string): string {
  return DRILL_SPORTS.find((s) => s.key === key)?.label ?? key;
}

export type DrillFilter = { sport?: string | null; focus?: string | null; age?: string | null; q?: string | null };

const AGE_ORDER: Record<string, number> = { "All ages": 0, "U8+": 1, "U10+": 2, "U12+": 3, "U14+": 4, "U16+": 5 };

/**
 * Filter drills. `age` keeps drills suitable for that group or younger (a U12+ group also sees U8+ drills).
 */
export function filterDrills<T extends { sport: string; title: string; description?: string | null; ageGroup?: string | null; focus?: readonly string[] }>(
  drills: readonly T[],
  f: DrillFilter,
): T[] {
  const q = (f.q ?? "").toLowerCase().trim();
  const ageMax = f.age && f.age in AGE_ORDER ? AGE_ORDER[f.age] : null;
  return drills.filter((x) => {
    if (f.sport && x.sport !== f.sport) return false;
    if (f.focus && !(x.focus ?? []).includes(f.focus)) return false;
    if (ageMax !== null) {
      const a = AGE_ORDER[x.ageGroup ?? "All ages"] ?? 0;
      if (a > ageMax) return false;
    }
    if (q && !`${x.title} ${x.description ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
