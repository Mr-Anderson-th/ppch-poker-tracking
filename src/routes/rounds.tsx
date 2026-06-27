import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { usePlayers, useResults, useRounds, useSettings, useSeasons } from "@/lib/queries";
import { format } from "date-fns";

export const Route = createFileRoute("/rounds")({
  head: () => ({ meta: [{ title: "Rounds — PPCH" }] }),
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
  const navigate = useNavigate();

  const sorted = [...rounds].sort((a, b) => +new Date(b.played_at) - +new Date(a.played_at));

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Rounds</h1>
          <p className="text-sm text-muted-foreground mt-1">{rounds.length} rounds played · click any row for details</p>
        </div>
        <Link to="/clock" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 btn-glow">
          Start a round →
        </Link>
      </header>

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
                {sorted.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No rounds yet. <Link to="/clock" className="text-primary hover:underline">Start one →</Link></td></tr>
                )}
                {sorted.map((r) => {
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
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(r.played_at), "MMM d, yyyy")}</td>
                      <td className="px-2 py-3 font-medium">{r.name}</td>
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
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button asChild variant="outline" size="sm" className="gap-1 hover:bg-primary hover:text-primary-foreground hover:border-primary">
                          <Link to="/rounds/$id" params={{ id: r.id }}>
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
