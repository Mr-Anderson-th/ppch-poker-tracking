import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlayers, useResults, useRounds, useSettings, useSeasons, type Player } from "@/lib/queries";
import { RoundsBarChart, type RoundBarDatum } from "@/components/dashboard/RoundsBarChart";
import { MiniKpi } from "@/components/dashboard/MiniKpi";
import { DonutCard, type Slice } from "@/components/dashboard/DonutCard";
import { format } from "date-fns";
import { Trophy, Flame, Snowflake, Coins, RotateCcw, TrendingUp, Layers, ShieldCheck, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PPCH Poker Club" },
      { property: "og:title", content: "Dashboard — PPCH Poker Club" },
      { property: "og:description", content: "Live season stats, round telemetry and player form for PPCH poker nights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "Game and player statistics for PPCH poker nights." },
    ],
  }),
  component: Dashboard,
});

function fmtMoney(n: number, c = "฿") {
  return `${c}${Math.round(n).toLocaleString()}`;
}

const ROUNDS_SEARCH = { season: "", player: "", q: "", from: "", to: "" };

function pctDelta(cur: number, prev: number | null): number | null {
  if (prev == null || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function Dashboard() {
  const { data: players = [] } = usePlayers();
  const { data: allRounds = [] } = useRounds();
  const { data: allResults = [] } = useResults();
  const { data: settings } = useSettings();
  const { data: seasons = [] } = useSeasons();
  const currency = settings?.currency ?? "฿";

  const activeSeason = useMemo(() => seasons.find((s) => !s.ended_at), [seasons]);
  const [seasonFilter, setSeasonFilter] = useState<string>("__active");
  const effectiveSeasonId =
    seasonFilter === "__active" ? activeSeason?.id ?? null : seasonFilter === "__all" ? null : seasonFilter;
  const selectedSeason = effectiveSeasonId ? seasons.find((s) => s.id === effectiveSeasonId) : null;

  const rounds = useMemo(
    () => (effectiveSeasonId ? allRounds.filter((r) => r.season_id === effectiveSeasonId) : allRounds),
    [allRounds, effectiveSeasonId],
  );
  const roundIdSet = useMemo(() => new Set(rounds.map((r) => r.id)), [rounds]);
  const results = useMemo(
    () => (effectiveSeasonId ? allResults.filter((r) => roundIdSet.has(r.round_id)) : allResults),
    [allResults, roundIdSet, effectiveSeasonId],
  );

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => +new Date(b.played_at) - +new Date(a.played_at)),
    [rounds],
  );

  // ---- Sub-metrics ----
  const sub = useMemo(() => {
    const n = rounds.length;
    const totalPot = rounds.reduce((s, r) => s + Number(r.total_pot), 0);
    const totalRebuys = rounds.reduce((s, r) => s + r.total_rebuys, 0);
    const totalPlayers = rounds.reduce((s, r) => s + r.total_players, 0);
    return {
      rounds: n,
      totalPot,
      avgPot: n ? totalPot / n : 0,
      avgBuyIn: n ? rounds.reduce((s, r) => s + Number(r.buy_in), 0) / n : 0,
      avgRebuy: totalPlayers ? totalRebuys / totalPlayers : 0,
      uniquePlayers: new Set(results.map((r) => r.player_id)).size,
    };
  }, [rounds, results]);

  // ---- Grouped bar chart (last 10 rounds) ----
  const barData = useMemo<RoundBarDatum[]>(() => {
    return [...sortedRounds]
      .slice(0, 10)
      .reverse()
      .map((r) => {
        const w = results.find((x) => x.round_id === r.id && x.finish_position === 1);
        return {
          label: r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name,
          date: format(new Date(r.played_at), "MMM d, yyyy"),
          winner: w ? playerById.get(w.player_id)?.name ?? "—" : "—",
          pot: Math.round(Number(r.total_pot)),
          minutes: Math.round(r.duration_seconds / 60),
          players: r.total_players,
          rebuys: r.total_rebuys,
        };
      });
  }, [sortedRounds, results, playerById]);

  // ---- Per player aggregates (current scope) ----
  type Agg = {
    player: Player; points: number; wins: number; rounds: number; net: number; rebuys: number; bestSingle: number;
  };
  const aggregate = (roundIds: Set<string>): Agg[] => {
    const map = new Map<string, Agg>();
    for (const p of players) map.set(p.id, { player: p, points: 0, wins: 0, rounds: 0, net: 0, rebuys: 0, bestSingle: 0 });
    for (const r of allResults) {
      if (!roundIds.has(r.round_id)) continue;
      const m = map.get(r.player_id);
      if (!m) continue;
      m.points += r.points_awarded;
      m.rounds += 1;
      if (r.finish_position === 1) m.wins += 1;
      m.net += Number(r.net_amount);
      m.rebuys += r.rebuys;
      if (Number(r.net_amount) > m.bestSingle) m.bestSingle = Number(r.net_amount);
    }
    return Array.from(map.values());
  };

  const perPlayer = useMemo(() => aggregate(roundIdSet), [players, allResults, roundIdSet]);

  // Comparison scope = previous season (or all-time excluding current scope)
  const prevPerPlayer = useMemo(() => {
    const ended = seasons.filter((s) => s.ended_at).sort((a, b) => +new Date(b.ended_at!) - +new Date(a.ended_at!));
    let prevId: string | null = null;
    if (effectiveSeasonId) {
      const idx = ended.findIndex((s) => s.id === effectiveSeasonId);
      prevId = idx === -1 ? ended[0]?.id ?? null : ended[idx + 1]?.id ?? null;
    }
    const prevRoundIds = new Set(
      (prevId ? allRounds.filter((r) => r.season_id === prevId) : allRounds.filter((r) => !roundIdSet.has(r.id))).map((r) => r.id),
    );
    if (prevRoundIds.size === 0) return null;
    return aggregate(prevRoundIds);
  }, [seasons, effectiveSeasonId, allRounds, roundIdSet, players, allResults]);

  const topOf = (arr: Agg[] | null, key: (a: Agg) => number, asc = false) => {
    if (!arr) return null;
    const filtered = arr.filter((a) => a.rounds > 0);
    if (!filtered.length) return null;
    return [...filtered].sort((a, b) => (asc ? key(a) - key(b) : key(b) - key(a)))[0]!;
  };

  const mostRebuys = topOf(perPlayer, (a) => a.rebuys);
  const leastRebuys = topOf(perPlayer, (a) => a.rebuys, true);
  const bigSingle = topOf(perPlayer, (a) => a.bestSingle);
  const prevMostRebuys = topOf(prevPerPlayer, (a) => a.rebuys);
  const prevLeastRebuys = topOf(prevPerPlayer, (a) => a.rebuys, true);
  const prevBigSingle = topOf(prevPerPlayer, (a) => a.bestSingle);

  const lastRound = sortedRounds[0];
  const prevRound = sortedRounds[1];
  const winnerOf = (roundId?: string) => {
    if (!roundId) return null;
    const w = allResults.find((r) => r.round_id === roundId && r.finish_position === 1);
    return w ? { player: playerById.get(w.player_id) ?? null, payout: Number(w.payout) } : null;
  };
  const lastWin = winnerOf(lastRound?.id);
  const prevWin = winnerOf(prevRound?.id);

  const streaks = useMemo(() => {
    const byPlayer = new Map<string, Array<{ played_at: string; finish: number }>>();
    for (const r of results) {
      const round = rounds.find((x) => x.id === r.round_id);
      if (!round) continue;
      if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
      byPlayer.get(r.player_id)!.push({ played_at: round.played_at, finish: r.finish_position });
    }
    let hot = { player: null as Player | null, streak: 0 };
    let cold = { player: null as Player | null, streak: 0 };
    for (const [pid, arr] of byPlayer) {
      arr.sort((a, b) => +new Date(b.played_at) - +new Date(a.played_at));
      let h = 0;
      for (const x of arr) { if (x.finish <= 3) h++; else break; }
      let c = 0;
      for (const x of arr) { if (x.finish > 3) c++; else break; }
      const p = playerById.get(pid);
      if (!p) continue;
      if (h > hot.streak) hot = { player: p, streak: h };
      if (c > cold.streak) cold = { player: p, streak: c };
    }
    return { hot, cold };
  }, [results, rounds, playerById]);

  // ---- Donut ----
  const [donutMode, setDonutMode] = useState<"points" | "net">("points");
  const donutSlices = useMemo<Slice[]>(
    () =>
      perPlayer.map((a, i) => ({
        id: a.player.id,
        name: a.player.name,
        color: a.player.avatar_color ?? `var(--chart-${(i % 5) + 1})`,
        value: donutMode === "points" ? a.points : Math.max(0, a.net),
      })),
    [perPlayer, donutMode],
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1500px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Showing{" "}
            <span className="font-medium text-foreground">
              {seasonFilter === "__all" ? "All-time" : selectedSeason ? selectedSeason.name : "no active season"}
            </span>
            {" · "}{sub.rounds} rounds · {sub.uniquePlayers} players
            {" · "}<Link to="/leaderboard" className="text-primary hover:underline">Leaderboard →</Link>
          </p>
        </div>
        <Select value={seasonFilter} onValueChange={setSeasonFilter}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__active">Current season{activeSeason ? ` (${activeSeason.name})` : ""}</SelectItem>
            <SelectItem value="__all">All-time</SelectItem>
            {seasons.filter((s) => s.ended_at).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* Performance · Last 10 Rounds */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Performance · Last 10 Rounds</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Pot, played time, players and re-buys per round — hover for details</p>
          </div>
          <BarChart3 className="size-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground text-sm">
              <Layers className="size-8 mb-2 opacity-40" />
              No round data yet. Play a tournament to see telemetry.
            </div>
          ) : (
            <RoundsBarChart data={barData} currency={currency} />
          )}

          {/* Sub-metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <SubMetric label="Total Pot · Season" value={fmtMoney(sub.totalPot, currency)} icon={Coins} />
            <SubMetric label="Avg Pot" value={fmtMoney(sub.avgPot, currency)} icon={TrendingUp} />
            <SubMetric label="Avg Buy-in" value={fmtMoney(sub.avgBuyIn, currency)} icon={ShieldCheck} />
            <SubMetric label="Avg Re-buy / Player" value={sub.avgRebuy.toFixed(2)} icon={RotateCcw} />
          </div>
        </CardContent>
      </Card>

      {/* Mini KPI badges */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniKpi
          icon={Trophy}
          tint="warning"
          label="Last Round Winner"
          value={lastWin?.player?.name ?? "—"}
          sub={lastRound ? format(new Date(lastRound.played_at), "MMM d, yyyy") : "—"}
          delta={pctDelta(lastWin?.payout ?? 0, prevWin?.payout ?? null)}
        />
        <MiniKpi
          icon={TrendingUp}
          tint="success"
          label="Biggest Single Win"
          value={bigSingle ? fmtMoney(bigSingle.bestSingle, currency) : "—"}
          sub={bigSingle?.player.name}
          delta={pctDelta(bigSingle?.bestSingle ?? 0, prevBigSingle?.bestSingle ?? null)}
        />
        <MiniKpi
          icon={RotateCcw}
          tint="info"
          label="Most Re-buys"
          value={mostRebuys ? String(mostRebuys.rebuys) : "—"}
          sub={mostRebuys?.player.name}
          invert
          delta={pctDelta(mostRebuys?.rebuys ?? 0, prevMostRebuys?.rebuys ?? null)}
        />
        <MiniKpi
          icon={ShieldCheck}
          tint="primary"
          label="Least Re-buys"
          value={leastRebuys ? String(leastRebuys.rebuys) : "—"}
          sub={leastRebuys?.player.name}
          invert
          delta={pctDelta(leastRebuys?.rebuys ?? 0, prevLeastRebuys?.rebuys ?? null)}
        />
        <MiniKpi
          icon={Flame}
          tint="warning"
          label="Hot Streak (top-3)"
          value={streaks.hot.streak ? `${streaks.hot.streak} rounds` : "—"}
          sub={streaks.hot.player?.name}
        />
        <MiniKpi
          icon={Snowflake}
          tint="info"
          label="Cold Streak (no top-3)"
          value={streaks.cold.streak ? `${streaks.cold.streak} rounds` : "—"}
          sub={streaks.cold.player?.name}
          invert
        />
      </div>

      {/* Distribution donut */}
      <DonutCard
        title={donutMode === "points" ? "Points share by player" : "Net money share by player"}
        slices={donutSlices}
        mode={donutMode}
        onModeChange={(m) => setDonutMode(m as "points" | "net")}
        modes={[{ value: "points", label: "Points" }, { value: "net", label: "Net money" }]}
        format={(n) => (donutMode === "points" ? String(Math.round(n)) : fmtMoney(n, currency))}
      />

      {/* Recent rounds */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Rounds</CardTitle>
          <Link to="/rounds" search={ROUNDS_SEARCH} className="text-sm text-primary hover:underline">View all →</Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-2 py-2.5">Name</th>
                  <th className="text-right px-2 py-2.5">Players</th>
                  <th className="text-right px-2 py-2.5">Pot</th>
                  <th className="text-left px-2 py-2.5">Winner</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {sortedRounds.slice(0, 8).map((r) => {
                  const winner = results.find((x) => x.round_id === r.id && x.finish_position === 1);
                  const wp = winner ? playerById.get(winner.player_id) : null;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      <td className="px-4 py-2.5 text-muted-foreground">{format(new Date(r.played_at), "MMM d")}</td>
                      <td className="px-2 py-2.5 font-medium">{r.name}</td>
                      <td className="px-2 py-2.5 text-right">{r.total_players}</td>
                      <td className="px-2 py-2.5 text-right">{fmtMoney(Number(r.total_pot), currency)}</td>
                      <td className="px-2 py-2.5">{wp ? <span className="inline-flex items-center gap-2"><Avatar player={wp} /> {wp.name}</span> : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link to="/rounds/$id" params={{ id: r.id }} className="text-primary text-xs hover:underline">Details →</Link>
                      </td>
                    </tr>
                  );
                })}
                {sortedRounds.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No rounds saved yet. <Link to="/clock" className="text-primary hover:underline">Start one →</Link></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SubMetric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 flex items-center gap-3">
      <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none truncate">{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function Avatar({ player }: { player: Player }) {
  const initials = player.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="size-6 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0"
      style={{ background: player.avatar_color ?? "#6366f1" }}
    >
      {initials}
    </div>
  );
}
