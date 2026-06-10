# Poker **PPCH CHAMPIONSHIP** Tracker  
Pakree Poker Clue House Version 2.0

A clean, light SaaS-style web app for tracking your home poker tournaments (10–20 players), running the live blind clock, and analyzing results over time.

## App structure (4 pages + admin gate)

1. **Dashboard** (`/`) — stats overview
2. **Tournament Clock** (`/clock`) — interactive blind timer + live round entry
3. **Players** (`/players`, `/players/$id`) — leaderboard + per-player detail
4. **Rounds** (`/rounds`, `/rounds/$id`) — round history + per-round detail
5. **Admin** (`/admin`) — locked behind a single shared password; create/edit players, edit/delete rounds, manage settings

Top nav: Dashboard · Clock · Players · Rounds · Admin (lock icon).

## 1. Dashboard

**Game stats cards:** Total Rounds · Total Points Awarded · Avg Points/Round · Total Pot · Avg Pot · Avg Buy-in · Total Unique Players · Avg Players/Round

**Player highlights:**

- Most Wins (most 1st places)
- Last Round Winner
- Biggest Profit (all-time net)
- Most Re-buys
- Hot Player (current win streak — consecutive top-3 or 1st)
- **Cold Player** (longest current streak without a top-3 finish — the "word you didn't know" → "Cold streak" / "Drought leader")
- Most Consistent (lowest std-dev of finish)
- Biggest Single-Round Win

**Leaderboard table** — all players ranked by total points (100/75/60/50/40/30/25/20/15/10/0).

**Performance telemetry (last 10 rounds)** — line chart, filter by: Player (multi-select) · Metric (Points / Net Money / Finish Position).

**Recent rounds table** — date, name, players, winner, pot, top 3.

## 2. Tournament Clock

Big circular timer (inspired by your PPPoker reference, but light theme to match dashboard) showing current blind level countdown.

**Setup panel (before start):**

- Round name / number (auto-default: "Round #N — {date}")
- Buy-in amount + Re-buy amount
- Payout structure: Winner-take-all · 50/30/20 · 50/25/15/10 · Custom %
- Blind level duration: 5 / 10 / 15 / 20 / 30 min
- Blind multiplier per level: 0.5 / 1.0 / 1.5 / 2.0 (chips rounded up to nearest 25)
- Starting blinds (SB/BB/ante)
- Add players (select from roster — admin can add new mid-setup if unlocked)

**During play:**

- Big timer, current SB/BB/ante, next level preview, elapsed time, prize pool, players remaining
- **Spacebar** = pause/resume
- **Knock out player**: click player chip → records bust position + blind level at bust
- **Re-buy player**: click → +1 re-buy, pot updates
- When 1 player remains → tournament ends → confirm finishing order → save round → points auto-awarded

All clock controls work for any visitor (view + run clock); saving the round writes to the database (logged with timestamp + device/session id).

## 3. Players page

- Roster grid with avatar/initials, total points, rounds played, win rate, net $
- Click → player detail: full stat sheet, finish-position histogram, points over time chart, profit curve, head-to-head vs other players, every round they played

## 4. Rounds page

- Sortable/filterable table of all rounds
- Click → round detail: full finishing order, blind progression timeline, knockouts with blind level, re-buys, payout breakdown

## 5. Admin

- Single shared password (stored as hash in DB, set on first launch)
- Once unlocked (session-only), shows: add/edit/delete players, edit/delete past rounds, change point system, change default clock settings
- Non-admin visitors can: view everything, run the clock, save round results

## Technical details

- **Stack:** TanStack Start (already set up) + Tailwind + shadcn/ui + Recharts for graphs
- **Backend:** Lovable Cloud (Postgres + auth-less, gated by admin password hash)
- **Tables:** `players`, `rounds`, `round_results` (player_id, finish, rebuys, bust_level, net), `clock_sessions` (audit log), `settings` (admin password hash, point system, defaults)
- **Point system:** stored in `settings` so admin can tweak later, defaulted to your values (100/75/60/50/40/30/25/20/15/10)
- **Chip rounding:** `Math.ceil(blind * multiplier / 25) * 25`
- **Realtime:** clock state local; round results sync on save. Optional: broadcast clock to other viewers via Supabase Realtime (nice-to-have, can defer)
- **Design:** Light theme like your Base SaaS UI Kit reference — white cards, soft shadows, blue/indigo primary, coral/amber accents, rounded corners, Inter or similar clean sans. Timer page gets a hero circular ring with gradient stroke.

## Build order

1. Cloud backend + schema + admin password ( Set Username=admin, Password=935639)
2. Player & round CRUD + admin gate
3. Dashboard with stats + charts
4. Tournament clock (setup → run → save)
5. Player detail + Round detail pages
6. Polish, empty states, mobile responsiveness

Want me to proceed, or tweak anything (e.g. add realtime shared clock, different payout presets, currency symbol)?