import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Filter, X } from "lucide-react";
import { usePlayers, useResults, useRounds, useSettings, useSeasons } from "@/lib/queries";
import { format } from "date-fns";

type RoundsSearch = {
  season: string;
  player: string;
  q: string;
  from: string;
  to: string;
};

export const Route = createFileRoute("/rounds/")({
  head: () => ({ meta: [{ title: "Rounds — PPCH" }] }),
  validateSearch: (search: Record<string, unknown>): RoundsSearch => ({
    season: typeof search.season === "string" ? search.season : "",
    player: typeof search.player === "string" ? search.player : "",
    q: typeof search.q === "string" ? search.q : "",
    from: typeof search.from === "string" ? search.from : "",
    to: typeof search.to === "string" ? search.to : "",
  }),
  component: RoundsPage,
});

function RoundsPage() {
  const { data: rounds = [] } = useRounds();
  const { data: results = [] } = useResults();
  const { data: players = [] } = usePlayers();
  const { data: settings } = useSettings();
  const { data: seasons = [] } = useSeasons();
  const currency = settings?.currency ?? "฿";
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const seasonById = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);
  const navigate = useNavigate({ from: "/rounds/" });
  const search = Route.useSearch();

  const setSearch = (patch: Partial<RoundsSearch>) =>
    navigate({ search: (prev: RoundsSearch) => ({ ...prev, ...patch }) });

  const filtered = useMemo(() => {
    let arr = [...rounds].sort((a, b) => +new Date(b.played_at) - +new Date(a.played_at));
    if (search.season) arr = arr.filter((r) => r.season_id === search.season);
    if (search.q) {
      const q = search.q.toLowerCase();
      arr = arr.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (search.from) {
      const from = +new Date(search.from);
      arr = arr.filter((r) => +new Date(r.played_at) >= from);
    }
    if (search.to) {
      const to = +new Date(search.to) + 24 * 60 * 60 * 1000;
      arr = arr.filter((r) => +new Date(r.played_at) < to);
    }
    if (search.player) {
      const inRound = new Set(results.filter((x) => x.player_id === search.player).map((x) => x.round_id));
      arr = arr.filter((r) => inRound.has(r.id));
    }
    return arr;
  }, [rounds, results, search]);

  const hasFilters = !!(search.season || search.player || search.q || search.from || search.to);

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Rounds</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {rounds.length} rounds · click any row for details
          </p>
        </div>
        <Link to="/clock" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 btn-glow">
          Start a round →
        </Link>
      </header>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-3">
            <Filter className="size-3.5" /> Filters
            {hasFilters && (
              <button
                onClick={() => setSearch({ season: "", player: "", q: "", from: "", to: "" })}
                className="ml-auto inline-flex items-center gap-1 normal-case text-xs text-primary hover:underline"
              >
                <X className="size-3" /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            <Select value={search.season || "all"} onValueChange={(v) => setSearch({ season: v === "all" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All seasons" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All seasons</SelectItem>
                {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{!s.ended_at && " · active"}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={search.player || "all"} onValueChange={(v) => setSearch({ player: v === "all" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All players" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All players</SelectItem>
                {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search by name…"
              value={search.q}
              onChange={(e) => setSearch({ q: e.target.value })}
              className="h-9"
            />
            <Input
              type="date"
              value={search.from}
              onChange={(e) => setSearch({ from: e.target.value })}
              className="h-9"
              placeholder="From"
            />
            <Input
              type="date"
              value={search.to}
              onChange={(e) => setSearch({ to: e.target.value })}
              className="h-9"
              placeholder="To"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-2 py-3">Name</th>
                  <th className="text-left px-2 py-3">Season</th>
                  <th className="text-right px-2 py-3">Players</th>
                  <th className="text-right px-2 py-3">Re-buys</th>
                  <th className="text-right px-2 py-3">Pot</th>
                  <th className="text-left px-2 py-3">Top 3</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {hasFilters ? "No rounds match these filters." : <>No rounds yet. <Link to="/clock" className="text-primary hover:underline">Start one →</Link></>}
                  </td></tr>
                )}
                {filtered.map((r) => {
                  const top = results
                    .filter((x) => x.round_id === r.id && x.finish_position <= 3)
                    .sort((a, b) => a.finish_position - b.finish_position);
                  const season = r.season_id ? seasonById.get(r.season_id) : undefined;
                  const goDetail = () => navigate({ to: "/rounds/$id", params: { id: r.id } });
                  return (
                    <tr
                      key={r.id}
                      onClick={goDetail}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goDetail(); } }}
                      tabIndex={0}
                      role="button"
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-secondary/60 focus:outline-none focus:bg-secondary/60 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.played_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-2 py-3 font-medium">
                        {r.name}
                      </td>
                      <td className="px-2 py-3 text-xs">
                        {season ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{season.name}</span>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-2 py-3 text-right">{r.total_players}</td>
                      <td className="px-2 py-3 text-right text-muted-foreground">{r.total_rebuys}</td>
                      <td className="px-2 py-3 text-right font-mono">{currency}{Number(r.total_pot).toLocaleString()}</td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-1">
                          {top.map((t) => {
                            const p = playerById.get(t.player_id);
                            if (!p) return null;
                            const tint = t.finish_position === 1 ? "bg-warning/20 text-warning" : t.finish_position === 2 ? "bg-info/20 text-info" : "bg-accent text-accent-foreground";
                            return (
                              <span key={t.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tint}`}>
                                #{t.finish_position} {p.name}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm" className="gap-1 hover:bg-primary hover:text-primary-foreground hover:border-primary">
                          <Link to="/rounds/$id" params={{ id: r.id }} preload="intent" onClick={(e) => e.stopPropagation()}>
                            View details <ChevronRight className="size-3.5" />
                          </Link>
                        </Button>
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