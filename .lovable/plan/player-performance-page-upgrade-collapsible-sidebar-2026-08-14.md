# Player Performance page upgrade + collapsible sidebar

## 1. New trend chart (Spline Line Chart Card)
Above the KPI grid, add a card with a smooth (spline) line chart of the player's rounds over time, in the selected season scope:
- Toggle between **Net money** and **Total points**.
- Two modes per metric: per-round value and cumulative running total (default cumulative for Net money, per-round for Points — toggle available).
- X axis = round date, tooltip shows round name, finish position, value.
- Uses the existing chart library and the app's design tokens (no hardcoded colors).

## 2. KPI row
Keep the existing six: ITM Rate, Win Rate, Rounds, Points, Money Won, Avg Re-buy.

Add three new Mini KPI badges below them (icon + value + up/down trend badge):
- **Time Played** — sum of the player's time in each round (bust time; falls back to round duration when the player finished 1st or the bust time is missing). Shown in hours (e.g. `12.4 h`); if under 1 hour, shown in minutes.
- **Hourly Rate** — net money ÷ hours played, e.g. `฿420/h`. Green when positive, red when negative.
- **Growth Rate** — momentum: compares the average net money per round of the most recent half of the player's rounds against the earlier half, expressed as a percentage change (needs at least 4 rounds; otherwise shows `—`). This captures "is this player trending up or down".

Each of the three compares against the group average of other players, same as the existing cards.

## 3. Skill matrix (radar) — revised axes
Same 0–10 scale and neon gaming design; axis 2, 3 and 4 change meaning and name:

| Axis | Name | Meaning | Formula (avg over rounds, clamped 0–10) |
|---|---|---|---|
| 1 | **Survival** | how long they last | unchanged: bust time / round duration × 10 |
| 2 | **Discipline** (was Efficiency) | fewer re-buys = better | `10 / (1 + avg re-buys per round)` |
| 3 | **Cash Rate** (was Aggression) | how often in the money | ITM rounds / rounds played × 10 |
| 4 | **Earning Power** (was Pot Dominance) | hourly rate score | player hourly rate scaled against the best hourly rate among all players in scope × 10 (0 when negative) |
| 5 | **Consistency** | finish position vs field | unchanged |

Group-average comparison overlay stays.

## 4. Recent rounds
Unchanged, stays at the bottom.

## 5. Collapsible sidebar
Add a collapse/expand toggle button to the desktop sidebar in the app shell: collapsed state shows icons only (narrow rail) with tooltips, expanded shows the current full nav. The choice is remembered in local storage. Mobile top nav is unchanged.

## Technical notes
- Axis changes live in `computePlayerAxes` in `src/lib/points.ts` (renamed keys) and `src/components/PlayerRadar.tsx` (labels/descriptions).
- New chart + mini KPIs are presentation components under `src/components/`, consumed by `src/routes/players.$id.tsx`.
- Sidebar collapse handled in `src/components/AppShell.tsx` with a small localStorage-backed state.
- No database or schema changes; all values are derived from existing round/result data.
