## Goal
Copy all existing data from the old project (https://pakree-poker-stats.lovable.app) into this new PPCH app so the dashboard/players/rounds pages aren't empty.

## Source data (already fetched from old project's public API)
- **16 players** (name, nickname, avatar_url) — Thai/English names like นุ้ย/Nui, นาย/Nine, บีม/Beam, etc.
- **14 rounds** (round_number, played_at, buy_in 100 or 200, rebuy 100 or 200)
- **111 round_results** (round_id, player_id, position, rebuys, points)

## Schema mapping (old → new)

| Old field | New field | Notes |
|---|---|---|
| `players.name` | `players.name` | direct |
| `players.nickname` | `players.nickname` | direct |
| `players.avatar_url` | (ignored) | new schema uses `avatar_color`; assign a stable color per player |
| `rounds.round_number` | `rounds.name` | becomes `"Round N"` |
| `rounds.played_at` | `rounds.played_at` | direct |
| `rounds.buy_in_amount` | `rounds.buy_in` | direct |
| `rounds.rebuy_amount` | `rounds.rebuy_amount` | direct |
| (none) | `rounds.payout_structure` | default `[100]` (winner-take-all) |
| (none) | `rounds.level_minutes / blind_multiplier / starting_sb/bb` | defaults from settings (15 / 1.5 / 25 / 50) |
| `round_results.position` | `round_results.finish_position` | direct |
| `round_results.rebuys` | `round_results.rebuys` | direct |
| `round_results.eliminated_at_level` | (ignored, all null) | leave bust_* null |
| `round_results.points` | `round_results.points_awarded` | **kept as-is** from old project (their score) |
| (computed) | `round_results.payout` | winner of each round gets full pot, others 0 |
| (computed) | `round_results.net_amount` | `payout − (buy_in + rebuys×rebuy_amount)` |
| (computed) | `rounds.total_players / total_rebuys / total_pot` | summed from results |

## Implementation steps

1. **Fetch** all 3 tables from the old project's anon-keyed REST API (no auth needed — public read).
2. **Write a one-shot import script** (`scripts/import-old-data.ts`) run via `bun`:
   - Connects to this project's DB using `SUPABASE_SERVICE_ROLE_KEY` (already a secret).
   - Builds a player-id remap (old UUID → new UUID) by inserting players and reading back ids. Assigns each player a deterministic `avatar_color` from a small palette.
   - Inserts rounds with computed pot/totals.
   - Inserts results with remapped player_ids, computed payout/net.
   - Idempotent: skip players whose `name` already exists; skip rounds whose `name` already exists.
3. **Run the script once** from the sandbox (`bun run scripts/import-old-data.ts`).
4. **Verify** counts via `psql` and reload the dashboard.

## Notes / things I'm NOT changing
- Old project's points (e.g. position 2 = 3 pts in one round) are preserved exactly; this app's default point system (100/75/60/…) is NOT re-applied to historical rounds.
- Avatars (uploaded images) are not migrated — new app uses solid colors.
- No app code changes; only data import.

## What I need from you
- Confirm: **OK to import all 16 players / 14 rounds / 111 results** as described?
- Anything you want excluded (e.g. specific test rounds)?
