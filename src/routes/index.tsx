import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlayers, useResults, useRounds, useSettings, type Player, type RoundResult } from "@/lib/queries";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { Trophy, Flame, Snowflake, Coins, RotateCcw, TrendingUp, Users, Layers } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PPCH" },
      { name: "description", content: "Game and player statistics for PPCH poker nights." },
    ],
  }),
  component: Dashboard,
});

function fmtMoney(n: number, c = "฿") {
  return `${c}${Math.round(n).toLocaleString()}`;
}

function Dashboard() {
  const { data: players = [] } = usePlayers();
  const { data: rounds = [] } = useRounds();
  const { data: results = [] } = useResults();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? "฿";

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Game stats
  const gameStats = useMemo(() => {
    const totalRounds = rounds.length;
    const totalPot = rounds.reduce((s, r) => s + Number(r.total_pot), 0);
    const totalPlayers = rounds.reduce((s, r) => s + r.total_players, 0);
    const totalPoints = results.reduce((s, r) => s + r.points_awarded, 0);
    return {
      totalRounds,
      totalPoints,
      avgPoints: totalRounds ? Math.round(totalPoints / totalRounds) : 0,
      totalPot,
      avgPot: totalRounds ? Math.round(totalPot / totalRounds) : 0,
      avgBuyIn: totalRounds
        ? Math.round(rounds.reduce((s, r) => s + Number(r.buy_in), 0) / totalRounds)
        : 0,
      uniquePlayers: new Set(results.map((r) => r.player_id)).size,
      avgPlayers: totalRounds ? (totalPlayers / totalRounds).toFixed(1) : "0",
    };
  }, [rounds, results]);

  // Per-player aggregates
  const perPlayer = useMemo(() => {
    const map = new Map<string, {
      player: Player; points: number; wins: number; rounds: number; net: number; rebuys: number;
      finishes: number[]; bestSingle: number;
    }>();
    for (const p of players) {
      map.set(p.id, { player: p, points: 0, wins: 0, rounds: 0, net: 0, rebuys: 0, finishes: [], bestSingle: 0 });
    }
    for (const r of results) {
      const m = map.get(r.player_id);
      if (!m) continue;
      m.points += r.points_awarded;
      m.rounds += 1;
      if (r.finish_position === 1) m.wins += 1;
      m.net += Number(r.net_amount);
      m.rebuys += r.rebuys;
      m.finishes.push(r.finish_position);
      if (Number(r.net_amount) > m.bestSingle) m.bestSingle = Number(r.net_amount);
    }
    return Array.from(map.values());
  }, [players, results]);

  const leaderboard = useMemo(
    () => [...perPlayer].sort((a, b) => b.points - a.points || b.wins - a.wins),
    [perPlayer],
  );

  // Highlights
  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => +new Date(b.played_at) - +new Date(a.played_at)),
    [rounds],
  );

  const lastRound = sortedRounds[0];
  const lastWinner = useMemo(() => {
    if (!lastRound) return null;
    const w = results.find((r) => r.round_id === lastRound.id && r.finish_position === 1);
    return w ? playerById.get(w.player_id) : null;
  }, [lastRound, results, playerById]);

  // Hot/cold streak: consecutive rounds (most recent backward) with top-3 / not top-3
  const streaks = useMemo(() => {
    const playerRoundsByDate = new Map<string, Array<{ played_at: string; finish: number }>>();
    for (const r of results) {
      const round = rounds.find((x) => x.id === r.round_id);
      if (!round) continue;
      if (!playerRoundsByDate.has(r.player_id)) playerRoundsByDate.set(r.player_id, []);
      playerRoundsByDate.get(r.player_id)!.push({ played_at: round.played_at, finish: r.finish_position });
    }
    let hot = { player: null as Player | null, streak: 0 };
    let cold = { player: null as Player | null, streak: 0 };
    for (const [pid, arr] of playerRoundsByDate) {
      arr.sort((a, b) => +new Date(b.played_at) - +new Date(a.played_at));
      let h = 0;
      for (const x of arr) {
        if (x.finish <= 3) h++;
        else break;
      }
      let c = 0;
      for (const x of arr) {
        if (x.finish > 3) c++;
        else break;
      }
      const p = playerById.get(pid);
      if (!p) continue;
      if (h > hot.streak) hot = { player: p, streak: h };
      if (c > cold.streak) cold = { player: p, streak: c };
    }
    return { hot, cold };
  }, [results, rounds, playerById]);

  const mostWins = useMemo(
    () => [...perPlayer].sort((a, b) => b.wins - a.wins)[0],
    [perPlayer],
  );
  const biggestProfit = useMemo(
    () => [...perPlayer].sort((a, b) => b.net - a.net)[0],
    [perPlayer],
  );
  const mostRebuys = useMemo(
    () => [...perPlayer].sort((a, b) => b.rebuys - a.rebuys)[0],
    [perPlayer],
  );
  const bigSingle = useMemo(
    () => [...perPlayer].sort((a, b) => b.bestSingle - a.bestSingle)[0],
    [perPlayer],
  );

  // Telemetry: last 10 rounds
  const [metric, setMetric] = useState<"points" | "net" | "finish">("points");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const last10 = useMemo(() => sortedRounds.slice(0, 10).reverse(), [sortedRounds]);
  const chartData = useMemo(() => {
    return last10.map((rd) => {
      const row: Record<string, string | number> = { label: rd.name.length > 12 ? rd.name.slice(0, 12) + "…" : rd.name };
      const focus = selectedPlayers.length ? selectedPlayers : leaderboard.slice(0, 5).map((x) => x.player.id);
      for (const pid of focus) {
        const r = results.find((x) => x.round_id === rd.id && x.player_id === pid);
        const p = playerById.get(pid);
        if (!p) continue;
        const key = p.name;
        if (!r) { row[key] = 0; continue; }
        row[key] = metric === "points" ? r.points_awarded : metric === "net" ? Number(r.net_amount) : r.finish_position;
      }
      return row;
    });
  }, [last10, results, playerById, metric, selectedPlayers, leaderboard]);

  const chartPlayers = useMemo(() => {
    const ids = selectedPlayers.length ? selectedPlayers : leaderboard.slice(0, 5).map((x) => x.player.id);
    return ids.map((id) => playerById.get(id)).filter(Boolean) as Player[];
  }, [selectedPlayers, leaderboard, playerById]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1500px] mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stats across {gameStats.totalRounds} rounds · {gameStats.uniquePlayers} players
        </p>
      </header>

      {/* Game stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Rounds" value={gameStats.totalRounds} icon={Layers} tint="primary" />
        <StatCard label="Total Pot" value={fmtMoney(gameStats.totalPot, currency)} icon={Coins} tint="warning" />
        <StatCard label="Avg Pot" value={fmtMoney(gameStats.avgPot, currency)} icon={TrendingUp} tint="info" />
        <StatCard label="Avg Buy-in" value={fmtMoney(gameStats.avgBuyIn, currency)} icon={Coins} tint="success" />
        <StatCard label="Total Points" value={gameStats.totalPoints} icon={Trophy} tint="primary" />
        <StatCard label="Avg Points / Round" value={gameStats.avgPoints} icon={Trophy} tint="warning" />
        <StatCard label="Unique Players" value={gameStats.uniquePlayers} icon={Users} tint="info" />
        <StatCard label="Avg Players / Round" value={gameStats.avgPlayers} icon={Users} tint="success" />
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <HighlightCard
          icon={Trophy}
          tint="primary"
          title="Most Wins"
          name={mostWins?.player.name}
          sub={mostWins ? `${mostWins.wins} wins · ${mostWins.points} pts` : "—"}
        />
        <HighlightCard
          icon={Trophy}
          tint="warning"
          title="Last Round Winner"
          name={lastWinner?.name}
          sub={lastRound ? format(new Date(lastRound.played_at), "MMM d, yyyy") : "—"}
        />
        <HighlightCard
          icon={Coins}
          tint="success"
          title="Biggest Profit"
          name={biggestProfit?.player.name}
          sub={biggestProfit ? fmtMoney(biggestProfit.net, currency) : "—"}
          positive={biggestProfit && biggestProfit.net >= 0}
        />
        <HighlightCard
          icon={RotateCcw}
          tint="info"
          title="Most Re-buys"
          name={mostRebuys?.player.name}
          sub={mostRebuys ? `${mostRebuys.rebuys} re-buys` : "—"}
        />
        <HighlightCard
          icon={Flame}
          tint="warning"
          title="Hot Streak (top-3)"
          name={streaks.hot.player?.name}
          sub={streaks.hot.streak ? `${streaks.hot.streak} rounds` : "—"}
        />
        <HighlightCard
          icon={Snowflake}
          tint="info"
          title="Cold Streak (no top-3)"
          name={streaks.cold.player?.name}
          sub={streaks.cold.streak ? `${streaks.cold.streak} rounds` : "—"}
        />
        <HighlightCard
          icon={TrendingUp}
          tint="success"
          title="Biggest Single Win"
          name={bigSingle?.player.name}
          sub={bigSingle ? fmtMoney(bigSingle.bestSingle, currency) : "—"}
        />
        <HighlightCard
          icon={Users}
          tint="primary"
          title="Roster"
          name={`${players.length} players`}
          sub={`${players.filter((p) => p.active).length} active`}
        />
      </div>

      {/* Telemetry + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Performance · Last 10 Rounds</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Showing {chartPlayers.length} player{chartPlayers.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
                <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Points</SelectItem>
                  <SelectItem value="net">Net Money</SelectItem>
                  <SelectItem value="finish">Finish Pos.</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {players.slice(0, 16).map((p) => {
                const active = selectedPlayers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedPlayers((prev) =>
                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                      )
                    }
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
              {selectedPlayers.length > 0 && (
                <button
                  onClick={() => setSelectedPlayers([])}
                  className="text-xs px-2.5 py-1 rounded-full text-muted-foreground hover:bg-secondary"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="h-[280px]">
              {chartData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      reversed={metric === "finish"}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    {chartPlayers.map((p, i) => (
                      <Line
                        key={p.id}
                        dataKey={p.name}
                        stroke={p.avatar_color ?? `var(--chart-${(i % 5) + 1})`}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground sticky top-0 bg-card">
                  <tr>
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-2 py-2">Player</th>
                    <th className="text-right px-2 py-2">Pts</th>
                    <th className="text-right px-4 py-2">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No rounds yet</td></tr>
                  )}
                  {leaderboard.map((row, i) => (
                    <tr key={row.player.id} className="border-t border-border hover:bg-secondary/40">
                      <td className="px-4 py-2">
                        <RankBadge rank={i + 1} />
                      </td>
                      <td className="px-2 py-2">
                        <Link to="/players/$id" params={{ id: row.player.id }} className="flex items-center gap-2 hover:text-primary">
                          <Avatar player={row.player} />
                          <span className="font-medium truncate">{row.player.name}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">{row.points}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{row.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent rounds */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Rounds</CardTitle>
          <Link to="/rounds" className="text-sm text-primary hover:underline">View all →</Link>
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

function StatCard({ label, value, icon: Icon, tint }: { label: string; value: string | number; icon: React.ElementType; tint: "primary" | "warning" | "success" | "info" }) {
  const tints: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`size-11 rounded-xl grid place-items-center shrink-0 ${tints[tint]}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl md:text-2xl font-bold leading-none">{value}</div>
          <div className="text-[11px] text-muted-foreground mt-1.5 uppercase tracking-wide truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightCard({ icon: Icon, tint, title, name, sub, positive }: {
  icon: React.ElementType; tint: "primary" | "warning" | "success" | "info";
  title: string; name?: string | null; sub?: string | null; positive?: boolean | null;
}) {
  const tints: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${tints[tint]}`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="text-lg font-bold truncate mt-0.5">{name ?? "—"}</div>
            <div className={`text-xs mt-0.5 ${positive === false ? "text-destructive" : positive ? "text-success" : "text-muted-foreground"}`}>
              {sub ?? ""}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? "bg-warning/20 text-warning" :
    rank === 2 ? "bg-info/20 text-info" :
    rank === 3 ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground";
  return <span className={`inline-flex items-center justify-center size-6 rounded-md text-xs font-bold ${cls}`}>{rank}</span>;
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

function EmptyChart() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
      <Layers className="size-8 mb-2 opacity-40" />
      No round data yet. Play a tournament to see telemetry.
    </div>
  );
}
