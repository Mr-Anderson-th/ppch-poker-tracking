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
