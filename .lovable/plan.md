## Problem

Clicking "View performance" on `/players` changes the URL to `/players/$id` but the page keeps showing the players list. Playwright confirmed: `page.url === /players/{id}`, but rendered content = players list.

**Root cause:** With TanStack's flat file routing, `src/routes/players.tsx` becomes the **layout** for any `players.*` child route (like `players.$id.tsx`). But `players.tsx` currently renders the list UI directly with no `<Outlet />`, so `/players/$id` matches — the child just has nowhere to render.

## Fix

Split the current `players.tsx` into a layout + index leaf:

1. **Create `src/routes/players.index.tsx`** — move the entire current list UI (`PlayersPage`, `Mini`, all imports, `createFileRoute("/players/")`) into this new file. This becomes the `/players` route.

2. **Rewrite `src/routes/players.tsx`** as a pure layout:
   ```tsx
   import { createFileRoute, Outlet } from "@tanstack/react-router";
   export const Route = createFileRoute("/players")({
     component: () => <Outlet />,
   });
   ```
   Drop the `head` from here (index leaf will own the "Players — PPCH" title).

3. **No changes needed** to `players.$id.tsx` — it already declares `/players/$id` and will now render inside the layout's `<Outlet />`.

`routeTree.gen.ts` regenerates automatically.

## Verification

Playwright: navigate to `/players`, click "View performance" on the first card, confirm the URL updates AND the detail page (avatar header, KPI grid, radar chart, recent rounds table) actually renders.