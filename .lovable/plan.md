## 1. Clock — Blind structure presets

Replace the single "Blind multiplier" dropdown with a **Blind structure** selector with 3 modes:

- **Standard (WSOP T-2,000 Rule)** — Use a fixed WSOP-style level table (progression roughly 1.25×–1.5× tapering, with antes kicking in at level 3). Encoded as an explicit array in `src/lib/points.ts`:
  ```
  [25/50, 50/100, 75/150+a25, 100/200+a25, 150/300+a50, 200/400+a50,
   300/600+a75, 400/800+a100, 500/1000+a100, 700/1400+a200,
   1000/2000+a300, 1500/3000+a400, 2000/4000+a500, 3000/6000+a1000, ...]
  ```
  Scaled from the user's Starting SB/BB (levels are multiplied by `startSb / 25`).
- **Hyper-Turbo** — pure ×2 doubling every level.
- **Custom** — user-editable numeric multiplier (0.1–10), same UI as today.

Implementation: extend `buildBlindLevels()` to accept `{ mode: "wsop" | "hyper" | "custom"; multiplier?: number }`. Store the mode in state alongside multiplier. Blind preview table stays; DB still saves `blind_multiplier` (for WSOP we save `0` or a sentinel and reconstruct on replay is out of scope — we'll persist an effective multiplier of `1.5` for WSOP and `2` for Hyper so historical rounds stay compatible without a migration).

## 2. Clock — Payout rake option

Under the Payout selector, add:
- Checkbox **"Deduct rake from pot"**
- Numeric input **"Rake %"** (0–20, default 5) shown when checkbox is on

When active, `distributePot(pot * (1 - rake/100), structure)` is used. Payout preview shows the rake amount and net pot. Persisted implicitly via the final `payout` values on each result — no DB schema change.

## 3. Clock — Timer face redesign

In `RunningView`, move blind numbers off the top and place them **flanking the circle**:

```
      Level 5
   ┌──────────────┐
   │              │
SB │   12:34      │ BB
150│              │300
   │  Next 200/400│
   └──────────────┘
```

- SB label + value: absolutely positioned to the **left** of the SVG ring, vertically centered.
- BB label + value: absolutely positioned to the **right** of the SVG ring, vertically centered.
- Center of ring keeps countdown `mm:ss` and "Next: sb/bb" hint.
- Ante (if any) shown as a small chip below the ring.

Uses flexbox row with the SVG in the middle and two column labels on either side; keeps the existing gradient ring.

## 4. Round detail — % deltas on Total Pot & Played Time

In `src/routes/rounds.$id.tsx`, the summary metric cards for **Total Pot** and **Played Time** currently show only the raw value. Add the same `vs season avg` delta styling already used for Total Re-buy / Avg Re-buy:

- Compute season averages from rounds already fetched with `season_id === current.season_id` (excluding the current round).
- Total Pot: `((pot - avgPot) / avgPot) * 100` — show `▲ 12% vs season avg` in green, `▼` in red.
- Played Time: same formula on `duration_seconds`.
- Fall back to `—` when there's no other round in the season yet.

## Files touched

- `src/lib/points.ts` — add WSOP level table + updated `buildBlindLevels`.
- `src/routes/clock.tsx` — structure preset selector, rake checkbox/input, redesigned timer face.
- `src/routes/rounds.$id.tsx` — season-avg deltas for pot and duration cards.

No database migration, no server function changes.
