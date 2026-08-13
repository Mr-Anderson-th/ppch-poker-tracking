import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlayers, useResults, useRounds, useSeasons, useSettings, type Player } from "@/lib/queries";
import { ArrowDown, ArrowUp, ChevronsUpDown, Minus, Trophy } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — PPCH Poker Club" },
      { name: "description", content: "Season leaderboard with points, wins, buy-ins, re-buys and net money for every PPCH player." },
      { property: "og:title", content: "Leaderboard — PPCH Poker Club" },
      { property: "og:description", content: "Season standings and rank movement for the PPCH poker club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

type Row = {
  player: Player;
  points: number;
  wins: number;
  buyIns: number;
  rebuys: number;
  net: number;
};

type SortKey = "rank" | "player" | "points" | "wins" | "buyIns" | "rebuys" | "net";

function fmtMoney(n: number, c = "฿") {
  return `${n < 0 ? "-" : ""}${c}${Math.abs(Math.round(n)).toLocaleString()}`;
}

function LeaderboardPage() {
  const { data: players = [] } = usePlayers();
  const { data: allRounds = [] } = useRounds();
  const { data: allResults = [] } = useResults();
  const { data: seasons = [] } = useSeasons();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? "฿";

  const activeSeason = useMemo(() => seasons.find((s) => !s.ended_at), [seasons]);
  const [seasonFilter, setSeasonFilter] = useState<string>("__active");
  const effectiveSeasonId =
    seasonFilter === "__active" ? activeSeason?.id ?? null : seasonFilter === "__all" ? null : seasonFilter;
  const selectedSeason = effectiveSeasonId ? seasons.find((s) => s.id === effectiveSeasonId) : null;

  const rounds = useMemo(
    () =>
      [...(effectiveSeasonId ? allRounds.filter((r) => r.season_id === effectiveSeasonId) : allRounds)].sort(
        (a, b) => +new Date(b.played_at) - +new Date(a.played_at),
      ),
    [allRounds, effectiveSeasonId],
  );

  const build = (roundIds: Set<string>): Row[] => {
    const map = new Map<string, Row>();
    for (const p of players) map.set(p.id, { player: p, points: 0, wins: 0, buyIns: 0, rebuys: 0, net: 0 });
    for (const r of allResults) {
      if (!roundIds.has(r.round_id)) continue;
      const m = map.get(r.player_id);
      if (!m) continue;
      m.points += r.points_awarded;
      m.buyIns += 1;
      m.rebuys += r.rebuys;
      m.net += Number(r.net_amount);
      if (r.finish_position === 1) m.wins += 1;
    }
    return Array.from(map.values()).filter((r) => r.buyIns > 0);
  };

  const rank = (rows: Row[]) => [...rows].sort((a, b) => b.points - a.points || b.wins - a.wins || b.net - a.net);

  const current = useMemo(() => rank(build(new Set(rounds.map((r) => r.id)))), [rounds, players, allResults]);
  const previous = useMemo(
    () => rank(build(new Set(rounds.slice(1).map((r) => r.id)))),
    [rounds, players, allResults],
  );

  const prevRankById = useMemo(() => {
    const m = new Map<string, number>();
    previous.forEach((r, i) => m.set(r.player.id, i + 1));
    return m;
  }, [previous]);

  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [asc, setAsc] = useState(false);

  const rankById = useMemo(() => {
    const m = new Map<string, number>();
    current.forEach((r, i) => m.set(r.player.id, i + 1));
    return m;
  }, [current]);

  const sorted = useMemo(() => {
    const arr = [...current];
    const val = (r: Row): number | string => {
      switch (sortKey) {
        case "rank": return rankById.get(r.player.id) ?? 999;
        case "player": return r.player.name.toLowerCase();
        default: return r[sortKey];
      }
    };
    arr.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * (asc ? 1 : -1);
      }
      return (va - vb) * (asc ? 1 : -1);
    });
    if (sortKey === "rank") arr.reverse(); // rank sorts ascending by default
    return arr;
  }, [current, sortKey, asc, rankById]);

  const toggle = (key: SortKey) => {
    if (key === sortKey) setAsc((a) => !a);
    else {
      setSortKey(key);
      setAsc(key === "player");
    }
  };

  const Th = ({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th className={`px-3 py-2.5 ${align === "left" ? "text-left" : "text-right"}`}>
      <button
        onClick={() => toggle(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
          sortKey === k ? "text-foreground font-semibold" : ""
        }`}
      >
        {label}
        {sortKey === k ? (
          asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1200px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Trophy className="size-6 text-warning" /> Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {seasonFilter === "__all" ? "All-time" : selectedSeason ? selectedSeason.name : "No active season"} ·{" "}
            {rounds.length} rounds · arrows show movement since the latest round
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <Th k="rank" label="#" align="left" />
                  <Th k="player" label="Player" align="left" />
                  <Th k="points" label="Pts" />
                  <Th k="wins" label="Wins" />
                  <Th k="buyIns" label="Buy-in" />
                  <Th k="rebuys" label="Re-buy" />
                  <Th k="net" label="Net money" />
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No results in this season yet.</td></tr>
                )}
                {sorted.map((r) => {
                  const rk = rankById.get(r.player.id)!;
                  const prev = prevRankById.get(r.player.id);
                  const move = prev == null ? null : prev - rk;
                  return (
                    <tr key={r.player.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <RankBadge rank={rk} />
                          <Move move={move} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link to="/players/$id" params={{ id: r.player.id }} className="flex items-center gap-2 hover:text-primary">
                          <Avatar player={r.player} />
                          <span className="font-medium truncate">{r.player.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">{r.points}</td>
                      <td className="px-3 py-2.5 text-right">{r.wins}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{r.buyIns}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{r.rebuys}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${r.net >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmtMoney(r.net, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Move({ move }: { move: number | null }) {
  if (move == null) return <span className="text-[10px] text-muted-foreground">new</span>;
  if (move === 0) return <Minus className="size-3 text-muted-foreground" />;
  const up = move > 0;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold ${up ? "text-success" : "text-destructive"}`}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(move)}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? "bg-warning/20 text-warning" :
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
