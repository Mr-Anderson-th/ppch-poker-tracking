## 1. `/players` — better player detail entry + richer detail page

**Players list (`/players`)**
- Use `PlayerAvatar` so uploaded photos show (today the cards only render colored initials).
- Add a clear interactive **"View performance →"** button at the bottom of each card (in addition to the whole-card link) so it reads as actionable.
- Show season badges (🥇🥈🥉 + custom) next to each player's name.
- Add a small leaderboard rank chip (#1, #2…) sorted by current-season points.

**Player detail (`/players/$id`)**
- Header gets: large avatar, badges row (with tooltip "1st place — June 2026"), current season rank, and lifetime rank.
- New **Season selector** (All-time / current / past seasons) that filters every stat, chart, and the round history below.
- New cards: "Best finish", "Longest survival", "Biggest win (₿)", "Current streak" (consecutive ITM).
- New chart: **bust-time vs blind-level scatter** (when do you typically bust?).
- New chart: **head-to-head win-rate** vs each other active player (horizontal bar).
- Existing charts (profit curve, radar, histograms) stay but become season-aware.

## 2. `/rounds` — working Details link + cleaner row affordance

The detail page (`/rounds/$id`) already exists and works — the issue is the small text "Details →" doesn't feel clickable and the rest of the row isn't.

- Make the **entire row clickable** (navigate to `/rounds/$id` on click; keep keyboard a11y with role=button).
- Replace the text link with a real **"View details"** button on the right (primary outline, with chevron icon).
- Add hover state: row lifts + border highlight.
- Add a "Season" column / chip so each round shows which season it belongs to.

(No changes to the detail page itself in this turn unless you want them — say the word.)

## 3. `/admin` — End-of-Season + Badges

### End Season flow

New "Seasons" card on `/admin`:
- Shows **current season** (name, start date, # rounds, # players with points).
- Big **"End season & start new"** button (admin only, confirm dialog).
- On confirm:
  1. Snapshot the current season's leaderboard (player_id, rank, points, wins, net, rounds).
  2. Auto-award badges to top 3 (🥇 Champion, 🥈 Runner-up, 🥉 Third place) — plus any **custom auto-rules** the admin defined (e.g. "Most rebuys", "Biggest single win").
  3. Close the current season (`ended_at = now()`).
  4. Open a new season (admin enters a name, e.g. "July 2026", or leave blank for auto YYYY-MM).
- Past seasons are listed below with a "View leaderboard" link → opens read-only season page showing final standings + which badges were awarded.

### User-visible past seasons
- New public route `/seasons` listing all closed seasons.
- New `/seasons/$id` showing the frozen leaderboard + badge winners.
- Top-nav gets a "Seasons" tab.

### Badge system
Admin section "Badges" with full CRUD:
- Each badge has: name, emoji/icon, color, description, type = `manual` or `auto`, and (for auto) a `rule` enum.
- Badges show next to player names everywhere (list, detail, round results).
- Admin can also **manually grant/revoke** any badge to any player from the player detail page.

**Starter badges I'll seed (admin can edit/delete):**

| Badge | Icon | Rule | Description |
|---|---|---|---|
| Season Champion | 🥇 | auto: season rank 1 | Won a season |
| Runner-up | 🥈 | auto: season rank 2 | Finished 2nd in a season |
| Bronze | 🥉 | auto: season rank 3 | Finished 3rd in a season |
| First Blood | 🩸 | auto: first ever win | First tournament win |
| Iron Man | 🛡️ | auto: played every round in a season | Perfect attendance |
| High Roller | 💎 | auto: biggest single-round win in a season | Biggest pot in a season |
| Comeback Kid | 🔥 | auto: won after ≥2 rebuys | Won despite ≥2 rebuys |
| Bubble Boy | 🫧 | auto: most "just out of money" finishes in a season | Most bubble finishes |
| Shark | 🦈 | manual | Admin-granted |
| Fish | 🐟 | manual | Admin-granted (fun tag) |

## Technical section

### DB migration
- `seasons` table: `id`, `name`, `started_at`, `ended_at` (nullable = active), `created_at`. GRANTs + public SELECT policy.
- `rounds.season_id uuid references seasons(id)` — backfill existing rounds into a single "Season 1" row.
- `badges` table: `id`, `name`, `icon`, `color`, `description`, `kind` ('manual'|'auto'), `auto_rule` (enum nullable), `created_at`. Admin-only writes via server fn.
- `player_badges` table: `id`, `player_id`, `badge_id`, `season_id` (nullable for lifetime badges), `awarded_at`, `note`. Unique (player_id, badge_id, season_id).
- `season_standings` snapshot table: `season_id`, `player_id`, `rank`, `points`, `wins`, `rounds`, `net`. Frozen at season close.
- All public SELECT; writes via `createServerFn` with admin-password check (same pattern as existing `updateRound`).

### Server functions (add to `src/lib/api/admin.functions.ts`)
- `endSeason({ password, newSeasonName? })` — snapshots, awards auto-badges, closes + opens season in one transaction.
- `createBadge / updateBadge / deleteBadge`.
- `grantBadge / revokeBadge` (manual).
- `updatePlayer` extended to optionally pin/feature badges.

### Queries (`src/lib/queries.ts`)
- `useSeasons()`, `useSeason(id)`, `useSeasonStandings(id)`, `useBadges()`, `usePlayerBadges()`.
- Add `season_id` filter to existing `useResults()` / `useRounds()` for the season selector.

### New files
- `src/routes/seasons.tsx` + `src/routes/seasons.$id.tsx`.
- `src/components/BadgeChip.tsx` (icon + tooltip).
- `src/components/SeasonSelect.tsx`.

### Files edited
- `src/routes/players.tsx`, `src/routes/players.$id.tsx`, `src/routes/rounds.tsx`, `src/routes/admin.tsx`, `src/components/AppShell.tsx` (add Seasons nav), `src/lib/queries.ts`, `src/lib/api/admin.functions.ts`.

### About publishing
ใช่ — publish เว็บไปแล้วก็ยังให้ฉันช่วยปรับและแก้ได้ตามปกติ ทุกครั้งที่แก้ใน Lovable แล้วกด Publish ใหม่ เว็บ production จะอัปเดตตาม
