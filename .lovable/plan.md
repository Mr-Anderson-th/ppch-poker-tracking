# Dashboard rebuild + new Leaderboard page

## Dashboard (/dashboard)

Order of sections, top to bottom:

1. **Header** — keep title + season selector as-is.
2. **Performance · Last 10 Rounds** — replace the player line chart with a grouped bar chart of round-level metrics: Total pot, Played time (minutes), Players, Total re-buys. Since the scales differ wildly, bars are grouped per round with two Y axes (money on the left, counts/minutes on the right), and a rich hover tooltip shows all four values plus round name, date and winner.
3. **Sub-metrics row** — 4 compact cards under the chart: Total Pot (season), Avg Pot, Avg Buy-in, Avg Re-buy.
4. **Mini KPI badges** — 6 small cards, each with icon badge + value + up/down trend chip (green/red) comparing the current season value to the previous season (or to the all-time average when no previous season exists): Last Round Winner, Biggest Single Win, Most Re-buys, Least Re-buys, Hot Streak (top-3), Cold Streak (no top-3).
5. **Distribution donut** — donut chart card with a toggle between Points and Net Money. Center shows the top player's share %; a color-coded legend grid lists each player with their value and % share. Small contributors collapse into "Others".
6. **Recent Rounds** — unchanged table at the bottom.

The old Leaderboard card and the current 8-tile stat grid / 8 highlight cards are removed from the dashboard (their content folds into the sub-metrics row and mini KPI badges).

## New page: /leaderboard

Added to the sidebar nav (after Dashboard). Season selector matching the dashboard.

Table columns: `#`, Player, Pts, Wins, Buy-in (number of rounds entered), Re-buy (count), Net money.

- Rank movement arrow (green up / red down / grey dash) computed by comparing standings including the latest round vs. standings excluding it.
- Every column header is clickable to sort asc/desc, with an active-sort indicator.
- Player name links to the player detail page.

## Technical notes

- All new UI lives in `src/routes/dashboard.tsx`, a new `src/routes/leaderboard.tsx`, plus small presentational components (`MiniKpi`, `DonutCard`, `RoundsBarChart`) extracted into `src/components/dashboard/`.
- Data comes from the existing `usePlayers` / `useRounds` / `useResults` / `useSeasons` hooks — no schema or server changes.
- Buy-in count = number of `round_results` rows for that player in the selected season; re-buys = sum of `rebuys`.
- Charts use Recharts (already installed) with semantic tokens from `src/styles.css`; no hardcoded colors.
- `/leaderboard` gets its own `head()` metadata.
