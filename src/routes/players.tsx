import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { usePlayers, useResults, useBadges, usePlayerBadges } from "@/lib/queries";
import { PlayerAvatar } from "@/components/Avatar";
import { BadgeRow } from "@/components/BadgeChip";

export const Route = createFileRoute("/players")({
  head: () => ({ meta: [{ title: "Players — PPCH" }] }),
  component: PlayersPage,
});

function PlayersPage() {
  const { data: players = [] } = usePlayers();
  const { data: results = [] } = useResults();
  const { data: badges = [] } = useBadges();
  const { data: playerBadges = [] } = usePlayerBadges();
  const badgeById = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);

  const stats = useMemo(() => {
    const map = new Map<string, { points: number; rounds: number; wins: number; net: number; }>();
    for (const p of players) map.set(p.id, { points: 0, rounds: 0, wins: 0, net: 0 });
    for (const r of results) {
      const m = map.get(r.player_id);
      if (!m) continue;
      m.points += r.points_awarded;
      m.rounds += 1;
      m.net += Number(r.net_amount);
      if (r.finish_position === 1) m.wins += 1;
    }
    return map;
  }, [players, results]);

  const ranked = useMemo(() => {
    return [...players].sort((a, b) => (stats.get(b.id)?.points ?? 0) - (stats.get(a.id)?.points ?? 0));
  }, [players, stats]);
  const rankById = useMemo(() => new Map(ranked.map((p, i) => [p.id, i + 1])), [ranked]);

  const badgesFor = (playerId: string) =>
    playerBadges
      .filter((pb) => pb.player_id === playerId)
      .map((pb) => ({ badge: badgeById.get(pb.badge_id), note: pb.note }))
      .filter((x): x is { badge: NonNullable<typeof x.badge>; note: string | null } => !!x.badge)
      .map((x) => ({ badge: x.badge, tooltip: x.note ?? x.badge.description ?? undefined }));

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Players</h1>
        <p className="text-sm text-muted-foreground mt-1">{players.length} players · click any card to see their performance</p>
      </header>

      {players.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No players yet. <Link to="/admin" className="text-primary hover:underline">Admin can add some →</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {ranked.map((p) => {
            const s = stats.get(p.id)!;
            const rank = rankById.get(p.id) ?? 0;
            const pBadges = badgesFor(p.id);
            return (
              <Link key={p.id} to="/players/$id" params={{ id: p.id }} className="group">
                <Card className="hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex items-start gap-3">
                      <PlayerAvatar player={p} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold truncate">{p.name}</span>
                          {rank <= 3 && s.points > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rank === 1 ? "bg-warning/20 text-warning" : rank === 2 ? "bg-info/20 text-info" : "bg-accent text-accent-foreground"}`}>
                              #{rank}
                            </span>
                          )}
                        </div>
                        {p.nickname && <div className="text-xs text-muted-foreground truncate">{p.nickname}</div>}
                        {pBadges.length > 0 && (
                          <div className="mt-1.5"><BadgeRow badges={pBadges} size="xs" /></div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                      <Mini label="Pts" value={s.points} />
                      <Mini label="Wins" value={s.wins} />
                      <Mini label="Played" value={s.rounds} />
                      <Mini label="Net" value={s.net >= 0 ? `+${s.net}` : `${s.net}`} positive={s.net >= 0} negative={s.net < 0} />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
                      tabIndex={-1}
                    >
                      <span>View performance</span>
                      <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, positive, negative }: { label: string; value: string | number; positive?: boolean; negative?: boolean }) {
  return (
    <div className="bg-secondary/40 rounded p-1.5">
      <div className={`text-sm font-bold ${positive ? "text-success" : negative ? "text-destructive" : ""}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
