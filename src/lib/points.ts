export const DEFAULT_POINTS = [100, 75, 60, 50, 40, 30, 25, 20, 15, 10];

export function pointsForFinish(position: number, system: number[] = DEFAULT_POINTS): number {
  if (position < 1) return 0;
  return system[position - 1] ?? 0;
}

export function roundChip(value: number, step = 25): number {
  return Math.ceil(value / step) * step;
}

export function buildBlindLevels(
  startSb: number,
  startBb: number,
  multiplier: number,
  count = 30,
): Array<{ level: number; sb: number; bb: number; ante: number }> {
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
    sb = sb * multiplier;
    bb = bb * multiplier;
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
