import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayers, useSeasons, useSeasonStandings, usePlayerBadges, useBadges } from "@/lib/queries";
import { format } from "date-fns";
import { PlayerAvatar } from "@/components/Avatar";
import { BadgeChip } from "@/components/BadgeChip";

export const Route = createFileRoute("/seasons/$id")({
  head: () => ({ meta: [{ title: "Season — PPCH" }] }),
  component: SeasonDetail,
});

function SeasonDetail() {
  const { id } = useParams({ from: "/seasons/$id" });
  const { data: seasons = [] } = useSeasons();
  const { data: standings = [] } = useSeasonStandings(id);
  const { data: players = [] } = usePlayers();
  const { data: badges = [] } = useBadges();
  const { data: playerBadges = [] } = usePlayerBadges();
  const season = seasons.find((s) => s.id === id);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const badgeById = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);
  const seasonAwards = useMemo(() => playerBadges.filter((pb) => pb.season_id === id), [playerBadges, id]);

  if (!season) return <div className="p-8"><Link to="/seasons" className="text-primary">← Back</Link><p className="mt-4">Loading…</p></div>;

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-6">
      <Link to="/seasons" className="text-sm text-muted-foreground hover:text-primary">← All seasons</Link>

      <Card className="felt">
        <CardContent className="p-6">
          <h1 className="text-2xl md:text-3xl font-bold">{season.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(season.started_at), "MMM d, yyyy")} → {season.ended_at ? format(new Date(season.ended_at), "MMM d, yyyy") : "ongoing"}
          </p>
          {seasonAwards.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {seasonAwards.map((pb) => {
                const b = badgeById.get(pb.badge_id);
                const p = playerById.get(pb.player_id);
                if (!b || !p) return null;
                return (
                  <div key={pb.id} className="flex items-center gap-1.5 bg-secondary/60 rounded-full pl-1 pr-3 py-1">
                    <BadgeChip badge={b} tooltip={pb.note ?? undefined} size="xs" />
                    <span className="text-xs font-medium">{p.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Final standings</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-2 py-2">Player</th>
                  <th className="text-right px-2 py-2">Points</th>
                  <th className="text-right px-2 py-2">Wins</th>
                  <th className="text-right px-2 py-2">Rounds</th>
                  <th className="text-right px-4 py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {standings.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No standings recorded</td></tr>}
                {standings.map((s) => {
                  const p = playerById.get(s.player_id);
                  const medal = s.rank === 1 ? "bg-warning/20 text-warning" : s.rank === 2 ? "bg-info/20 text-info" : s.rank === 3 ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground";
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2"><span className={`inline-grid place-items-center size-6 rounded text-xs font-bold ${medal}`}>{s.rank}</span></td>
                      <td className="px-2 py-2">
                        {p ? (
                          <Link to="/players/$id" params={{ id: p.id }} className="flex items-center gap-2 hover:text-primary">
                            <PlayerAvatar player={p} size="sm" />
                            {p.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{s.points}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{s.wins}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{s.rounds_played}</td>
                      <td className={`px-4 py-2 text-right font-mono ${Number(s.net) >= 0 ? "text-success" : "text-destructive"}`}>
                        {Number(s.net) >= 0 ? "+" : ""}{Number(s.net).toLocaleString()}
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
