export const DEFAULT_POINTS = [100, 75, 60, 50, 40, 30, 25, 20, 15, 10];

export function pointsForFinish(position: number, system: number[] = DEFAULT_POINTS): number {
  if (position < 1) return 0;
  return system[position - 1] ?? 0;
}

export function roundChip(value: number, step = 25): number {
  return Math.ceil(value / step) * step;
}

export type BlindMode = "wsop" | "hyper" | "custom";

// WSOP-style "T-2,000 Rule" progression normalized to a 25/50 starting level.
// Each entry is [sb, bb, ante]. Antes kick in from level 3 onward.
const WSOP_BASE: Array<[number, number, number]> = [
  [25, 50, 0],
  [50, 100, 0],
  [75, 150, 25],
  [100, 200, 25],
  [150, 300, 50],
  [200, 400, 50],
  [300, 600, 75],
  [400, 800, 100],
  [500, 1000, 100],
  [700, 1400, 200],
  [1000, 2000, 300],
  [1500, 3000, 400],
  [2000, 4000, 500],
  [3000, 6000, 1000],
  [4000, 8000, 1000],
  [5000, 10000, 2000],
  [7000, 14000, 2000],
  [10000, 20000, 3000],
  [15000, 30000, 5000],
  [20000, 40000, 5000],
  [30000, 60000, 10000],
  [50000, 100000, 15000],
  [75000, 150000, 25000],
  [100000, 200000, 30000],
  [150000, 300000, 50000],
];

export function buildBlindLevels(
  startSb: number,
  startBb: number,
  multiplier: number,
  count = 30,
  mode: BlindMode = "custom",
): Array<{ level: number; sb: number; bb: number; ante: number }> {
  if (mode === "wsop") {
    const scale = Math.max(0.01, startSb / 25);
    return Array.from({ length: count }, (_, i) => {
      const src = WSOP_BASE[i] ?? WSOP_BASE[WSOP_BASE.length - 1];
      return {
        level: i + 1,
        sb: roundChip(src[0] * scale),
        bb: roundChip(src[1] * scale),
        ante: src[2] ? roundChip(src[2] * scale) : 0,
      };
    });
  }
  const m = mode === "hyper" ? 2 : multiplier;
  const out: Array<{ level: number; sb: number; bb: number; ante: number }> = [];
  let sb = startSb;
  let bb = startBb;
  for (let i = 0; i < count; i++) {
    out.push({
      level: i + 1,
      sb: roundChip(sb),
      bb: roundChip(bb),
      ante: i >= 3 ? roundChip(sb / 2) : 0,
    });
    sb = sb * m;
    bb = bb * m;
  }
  return out;
}

export const PAYOUT_PRESETS: Record<string, number[]> = {
  "Winner Take All": [100],
  "50 / 30 / 20": [50, 30, 20],
  "50 / 25 / 15 / 10": [50, 25, 15, 10],
  "40 / 25 / 20 / 10 / 5": [40, 25, 20, 10, 5],
};

export function distributePot(pot: number, structure: number[]): number[] {
  const totalPct = structure.reduce((a, b) => a + b, 0) || 100;
  return structure.map((p) => Math.round((pot * p) / totalPct));
}

// ============ Player skill axes (0-10) ============

type AxisRound = {
  id: string;
  duration_seconds: number | null;
  total_players: number;
  total_pot: number;
};
type AxisResult = {
  round_id: string;
  player_id: string;
  finish_position: number;
  rebuys: number;
  bust_bb: number | null;
  bust_time_seconds: number | null;
  payout: number;
  points_awarded: number;
  net_amount?: number;
};

export type PlayerAxes = {
  survival: number;
  discipline: number;
  cashRate: number;
  earningPower: number;
  consistency: number;
};

/** Hours a player spent in a round (bust time, fallback to full round duration). */
function playedSeconds(r: AxisResult, rd: { duration_seconds: number | null } | undefined): number {
  if (r.bust_time_seconds != null && r.bust_time_seconds > 0) return r.bust_time_seconds;
  return rd?.duration_seconds ?? 0;
}

export function hourlyRate(
  playerId: string,
  rounds: AxisRound[],
  results: AxisResult[],
): { hours: number; net: number; rate: number } {
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  let secs = 0;
  let net = 0;
  for (const r of results) {
    if (r.player_id !== playerId || !roundById.has(r.round_id)) continue;
    secs += playedSeconds(r, roundById.get(r.round_id));
    net += Number(r.net_amount ?? 0);
  }
  const hours = secs / 3600;
  return { hours, net, rate: hours > 0 ? net / hours : 0 };
}

/**
 * Compute 0-10 axes for a specific player across the provided rounds/results.
 * Only rounds present in `rounds` array are considered.
 */
export function computePlayerAxes(
  playerId: string,
  rounds: AxisRound[],
  results: AxisResult[],
): PlayerAxes {
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const scoped = results.filter((r) => roundById.has(r.round_id));
  const mine = scoped.filter((r) => r.player_id === playerId);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const clamp = (v: number) => Math.max(0, Math.min(10, v));

  // 1. Survival: bust_time / duration
  const survivalVals: number[] = [];
  for (const r of mine) {
    const rd = roundById.get(r.round_id);
    if (!rd?.duration_seconds || r.bust_time_seconds == null) continue;
    survivalVals.push((r.bust_time_seconds / rd.duration_seconds) * 10);
  }

  // 2. Discipline: fewer re-buys is better
  const avgRebuys = avg(mine.map((r) => r.rebuys));
  const discipline = mine.length ? 10 / (1 + avgRebuys) : 0;

  // 3. Cash rate: how often in the money
  const cashRate = mine.length
    ? (mine.filter((r) => Number(r.payout) > 0).length / mine.length) * 10
    : 0;

  // 4. Earning power: hourly rate scaled against the best hourly rate in scope
  const me = hourlyRate(playerId, rounds, scoped);
  const playerIds = Array.from(new Set(scoped.map((r) => r.player_id)));
  const bestRate = playerIds.reduce((m, pid) => Math.max(m, hourlyRate(pid, rounds, scoped).rate), 0);
  const earningPower = bestRate > 0 ? (Math.max(0, me.rate) / bestRate) * 10 : 0;

  // 5. Consistency: (1 - (finish-1)/total_players) * 10
  const consistencyVals: number[] = [];
  for (const r of mine) {
    const rd = roundById.get(r.round_id);
    if (!rd?.total_players) continue;
    consistencyVals.push((1 - (r.finish_position - 1) / rd.total_players) * 10);
  }

  return {
    survival: clamp(avg(survivalVals)),
    discipline: clamp(discipline),
    cashRate: clamp(cashRate),
    earningPower: clamp(earningPower),
    consistency: clamp(avg(consistencyVals)),
  };
}

