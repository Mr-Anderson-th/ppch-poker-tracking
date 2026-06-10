import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayers, useResults, type Player } from "@/lib/queries";

export const Route = createFileRoute("/players")({
  head: () => ({ meta: [{ title: "Players — PPCH" }] }),
  component: PlayersPage,
});

function PlayersPage() {
  const { data: players = [] } = usePlayers();
  const { data: results = [] } = useResults();

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

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Players</h1>
        <p className="text-sm text-muted-foreground mt-1">{players.length} players · click for detail</p>
      </header>

      {players.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No players yet. <Link to="/admin" className="text-primary hover:underline">Admin can add some →</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {players.map((p) => {
            const s = stats.get(p.id)!;
            return (
              <Link key={p.id} to="/players/$id" params={{ id: p.id }}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-full grid place-items-center text-base font-bold text-white" style={{ background: p.avatar_color ?? "#6366f1" }}>
                        {p.name.split(" ").map((c) => c[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{p.name}</div>
                        {p.nickname && <div className="text-xs text-muted-foreground truncate">{p.nickname}</div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                      <Mini label="Pts" value={s.points} />
                      <Mini label="Wins" value={s.wins} />
                      <Mini label="Played" value={s.rounds} />
                      <Mini label="Net" value={s.net >= 0 ? `+${s.net}` : `${s.net}`} positive={s.net >= 0} negative={s.net < 0} />
                    </div>
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
