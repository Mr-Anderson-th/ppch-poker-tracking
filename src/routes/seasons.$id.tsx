import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  usePlayers, useSeasons, useSeasonStandings, usePlayerBadges, useBadges,
  useRounds, useResults,
} from "@/lib/queries";
import { format } from "date-fns";
import { PlayerAvatar } from "@/components/Avatar";
import { BadgeChip } from "@/components/BadgeChip";

export const Route = createFileRoute("/seasons/$id")({
  head: () => ({ meta: [{ title: "Season — PPCH" }] }),
  component: SeasonDetail,
});

type StandingRow = {
  player_id: string;
  rank: number;
  points: number;
  wins: number;
  rounds_played: number;
  net: number;
};

function SeasonDetail() {
  const { id } = useParams({ from: "/seasons/$id" });
  const { data: seasons = [] } = useSeasons();
  const { data: snapshots = [] } = useSeasonStandings(id);
  const { data: players = [] } = usePlayers();
  const { data: badges = [] } = useBadges();
  const { data: playerBadges = [] } = usePlayerBadges();
  const { data: allRounds = [] } = useRounds();
  const { data: allResults = [] } = useResults();

  const season = seasons.find((s) => s.id === id);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const badgeById = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);
  const seasonAwards = useMemo(() => playerBadges.filter((pb) => pb.season_id === id), [playerBadges, id]);

  const seasonRounds = useMemo(
    () => allRounds.filter((r) => r.season_id === id).sort((a, b) => +new Date(b.played_at) - +new Date(a.played_at)),
    [allRounds, id],
  );
  const seasonRoundIds = useMemo(() => new Set(seasonRounds.map((r) => r.id)), [seasonRounds]);
  const seasonResults = useMemo(() => allResults.filter((r) => seasonRoundIds.has(r.round_id)), [allResults, seasonRoundIds]);

  // Live-computed standings (fallback when no snapshot exists)
  const liveStandings: StandingRow[] = useMemo(() => {
    const m = new Map<string, { player_id: string; points: number; wins: number; rounds_played: number; net: number }>();
    for (const r of seasonResults) {
      let a = m.get(r.player_id);
      if (!a) {
        a = { player_id: r.player_id, points: 0, wins: 0, rounds_played: 0, net: 0 };
        m.set(r.player_id, a);
      }
      a.points += r.points_awarded;
      a.rounds_played += 1;
      a.net += Number(r.net_amount);
      if (r.finish_position === 1) a.wins += 1;
    }
    return Array.from(m.values())
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.net - a.net)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [seasonResults]);

  const usingSnapshot = snapshots.length > 0;
  const standings: StandingRow[] = usingSnapshot
    ? snapshots.map((s) => ({
        player_id: s.player_id, rank: s.rank, points: s.points,
        wins: s.wins, rounds_played: s.rounds_played, net: Number(s.net),
      }))
    : liveStandings;

  if (!season) {
    return <div className="p-8"><Link to="/seasons" className="text-primary">← Back</Link><p className="mt-4">Season not found.</p></div>;
  }

  const isActive = !season.ended_at;

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-6">
      <Link to="/seasons" className="text-sm text-muted-foreground hover:text-primary">← All seasons</Link>

      <Card className="felt">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{season.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(season.started_at), "MMM d, yyyy")} → {season.ended_at ? format(new Date(season.ended_at), "MMM d, yyyy") : "ongoing"}
              </p>
            </div>
            {isActive ? (
              <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-success/15 text-success">Active</span>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">Closed</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <Mini label="Rounds" value={seasonRounds.length} />
            <Mini label="Players" value={new Set(seasonResults.map((r) => r.player_id)).size} />
            <Mini label="Total pot" value={`฿${seasonRounds.reduce((s, r) => s + Number(r.total_pot), 0).toLocaleString()}`} />
          </div>
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
        <CardHeader>
          <CardTitle className="text-base">
            {usingSnapshot ? "Final standings" : isActive ? "Live standings" : "Standings (computed)"}
          </CardTitle>
          {!usingSnapshot && (
            <p className="text-xs text-muted-foreground">Computed from this season's rounds — not yet frozen.</p>
          )}
        </CardHeader>
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
                {standings.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No data for this season yet</td></tr>}
                {standings.map((s) => {
                  const p = playerById.get(s.player_id);
                  const medal = s.rank === 1 ? "bg-warning/20 text-warning" : s.rank === 2 ? "bg-info/20 text-info" : s.rank === 3 ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground";
                  return (
                    <tr key={s.player_id} className="border-b border-border last:border-0">
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
                      <td className={`px-4 py-2 text-right font-mono ${s.net >= 0 ? "text-success" : "text-destructive"}`}>
                        {s.net >= 0 ? "+" : ""}{s.net.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rounds in this season ({seasonRounds.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-2 py-2">Name</th>
                  <th className="text-right px-2 py-2">Players</th>
                  <th className="text-right px-2 py-2">Pot</th>
                  <th className="text-left px-2 py-2">Winner</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {seasonRounds.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No rounds in this season</td></tr>}
                {seasonRounds.map((r) => {
                  const winner = seasonResults.find((x) => x.round_id === r.id && x.finish_position === 1);
                  const wp = winner ? playerById.get(winner.player_id) : null;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{format(new Date(r.played_at), "MMM d, yyyy")}</td>
                      <td className="px-2 py-2 font-medium">{r.name}</td>
                      <td className="px-2 py-2 text-right">{r.total_players}</td>
                      <td className="px-2 py-2 text-right font-mono">฿{Number(r.total_pot).toLocaleString()}</td>
                      <td className="px-2 py-2">{wp ? wp.name : "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <Link to="/rounds/$id" params={{ id: r.id }} className="text-primary text-xs hover:underline">View →</Link>
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

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-3">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
