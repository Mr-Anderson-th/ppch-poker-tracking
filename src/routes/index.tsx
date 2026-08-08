import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Spade, Play, Timer, Trophy, Users, Coins, ArrowUpRight, ArrowRight } from "lucide-react";
import { usePlayers, useRounds, useResults, useSeasons, useSettings } from "@/lib/queries";
import { PlayerAvatar } from "@/components/Avatar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PPCH Poker Club — Home Game Tracker & Blind Clock" },
      {
        name: "description",
        content:
          "PPCH Poker Club: live tournament clock, season leaderboards, player analytics and full round history for our home games.",
      },
      { property: "og:title", content: "PPCH Poker Club — Home Game Tracker & Blind Clock" },
      {
        property: "og:description",
        content: "Live tournament clock, season leaderboards and deep player stats for the PPCH home game.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: players = [] } = usePlayers();
  const { data: rounds = [] } = useRounds();
  const { data: results = [] } = useResults();
  const { data: seasons = [] } = useSeasons();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? "฿";

  const activeSeason = useMemo(() => seasons.find((s) => !s.ended_at), [seasons]);

  const seasonRounds = useMemo(
    () => (activeSeason ? rounds.filter((r) => r.season_id === activeSeason.id) : rounds),
    [rounds, activeSeason],
  );
  const roundIds = useMemo(() => new Set(seasonRounds.map((r) => r.id)), [seasonRounds]);
  const seasonResults = useMemo(
    () => (activeSeason ? results.filter((r) => roundIds.has(r.round_id)) : results),
    [results, roundIds, activeSeason],
  );

  const leaders = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of seasonResults) map.set(r.player_id, (map.get(r.player_id) ?? 0) + r.points_awarded);
    return Array.from(map.entries())
      .map(([id, points]) => ({ player: players.find((p) => p.id === id), points }))
      .filter((x) => x.player)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
  }, [seasonResults, players]);

  const totalPot = seasonRounds.reduce((s, r) => s + Number(r.total_pot), 0);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
        {/* NAV */}
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center">
              <Spade className="size-5" />
            </div>
            <div>
              <div className="font-display font-extrabold leading-none">PPCH</div>
              <div className="text-[11px] text-muted-foreground">Pakree Poker Clue House</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/clock"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Timer className="size-4" /> Clock
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Enter app <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </nav>

        {/* BENTO */}
        <div className="mt-6 grid gap-4 md:grid-cols-3 md:auto-rows-[minmax(0,auto)]">
          {/* HERO */}
          <section className="md:col-span-2 ink-card soft-card felt relative overflow-hidden p-8 md:p-12">
            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-primary/25 blur-3xl" />
            <div className="absolute -left-10 bottom-0 size-52 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-foreground">
                {activeSeason ? activeSeason.name : "Home game"} · live
              </span>
              <h1 className="mt-5 font-display text-4xl md:text-6xl font-extrabold leading-[1.02] tracking-tight">
                Poker night,
                <br />
                <span className="text-primary">properly scored.</span>
              </h1>
              <p className="mt-4 max-w-md text-sm md:text-base opacity-70">
                A tournament clock, live payouts, season leaderboards and per-player analytics — all for our
                Friday table.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/dashboard"
                  className="btn-glow inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground"
                >
                  <Play className="size-5 fill-current" /> Play
                </Link>
                <Link
                  to="/clock"
                  className="inline-flex items-center gap-2 rounded-full border border-current/20 px-6 py-3.5 text-sm font-semibold opacity-80 hover:opacity-100 transition-opacity"
                >
                  <Timer className="size-4" /> Start the clock
                </Link>
              </div>
            </div>
          </section>

          {/* LEADERBOARD */}
          <section className="soft-card bg-card border border-border p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Season leaders</h2>
              <Trophy className="size-4 text-primary" />
            </div>
            <ol className="mt-4 space-y-2.5">
              {leaders.length === 0 && <li className="text-sm text-muted-foreground">No rounds played yet.</li>}
              {leaders.map((l, i) => (
                <li key={l.player!.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2.5">
                  <span
                    className={`grid size-7 place-items-center rounded-full text-xs font-bold ${
                      i === 0 ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <PlayerAvatar player={l.player!} size="md" />
                  <span className="flex-1 truncate text-sm font-semibold">{l.player!.name}</span>
                  <span className="tabular-nums text-sm font-bold">{l.points}</span>
                </li>
              ))}
            </ol>
            <Link
              to="/dashboard"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Full leaderboard <ArrowRight className="size-3.5" />
            </Link>
          </section>

          {/* STATS */}
          <StatTile icon={Users} label="Players" value={String(players.length)} to="/players" />
          <StatTile icon={Timer} label="Rounds played" value={String(seasonRounds.length)} to="/rounds" />
          <StatTile
            icon={Coins}
            label="Pot this season"
            value={`${currency}${Math.round(totalPot).toLocaleString()}`}
            to="/rounds"
            highlight
          />
        </div>

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          PPCH · Pakree Poker Clue House
        </footer>
      </div>
    </main>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  to,
  highlight,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  to: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`soft-card group border p-6 transition-transform hover:-translate-y-0.5 ${
        highlight ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border"
      }`}
    >
      <Icon className={`size-5 ${highlight ? "" : "text-primary"}`} />
      <div className="mt-6 text-3xl font-extrabold tabular-nums">{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-sm ${highlight ? "opacity-80" : "text-muted-foreground"}`}>
        {label} <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
