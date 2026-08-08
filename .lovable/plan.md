# Landing page + full redesign + end-of-game celebration

## 1. Landing page at `/`

New single-screen landing (`src/routes/index.tsx`) in the reference style:
- Soft cream background, big rounded cards, black hero panel, yellow/red accents.
- Hero: club name "PPCH Poker", short tagline, and a large **Play** button that goes to `/dashboard`.
- A few live stat tiles pulled from real data (players count, rounds played, current season leader, total pot) laid out in a bento grid like the reference.
- Secondary links: Tournament Clock, Leaderboard.
- Own `head()` metadata (title, description, og tags).

The current dashboard moves to `src/routes/dashboard.tsx` unchanged in logic; nav and any internal links update to `/dashboard`.

## 2. Full design refresh (light only)

- Rewrite the token palette in `src/styles.css`: cream/off-white background, near-black surface cards, saffron yellow primary accent, coral red for emphasis, soft grey borders, larger radius (rounded-3xl feel).
- Remove dark mode: drop the `.dark` token block, delete `ThemeToggle` from the shell, and remove the theme bootstrapping in `src/lib/theme.ts` usage. All components keep semantic tokens, so no hardcoded colors.
- `AppShell`: convert the top nav into the reference's icon rail + rounded pill header, with a rounded search-less header bar and avatar chip.
- Card styling pass across dashboard, players, rounds, seasons, admin: bigger radius, softer shadows, black "feature" cards for headline stats, yellow progress accents.

## 3. Clock end-of-game celebration

When the tournament finishes on `/clock`, replace the current plain "Tournament finished" dialog with one full-screen results modal that contains:
- Confetti burst + animated 1-2-3 podium with avatars, names, and payout for each of the top three.
- Below it, the full summary table for every player: finish position, points awarded, payout, re-buys, net, bust blind level.
- Round totals row: total pot, rake, total re-buys, duration.
- Actions unchanged: Save round (existing `saveRound` server fn) and close.

Nothing about scoring, payouts, or the save flow changes — this is presentation plus the podium/confetti layer.

## Technical notes

- New route file `src/routes/dashboard.tsx`; `src/routes/index.tsx` becomes the landing. Keep `head()` metadata unique per route.
- Confetti via a small CSS/`motion`-free animated element rather than a new heavy dependency, unless `canvas-confetti` is already present.
- Podium data derives from the existing finished-seat ordering already computed in `clock.tsx`.
