import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlayers, useResults, useRounds, useSettings } from "@/lib/queries";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";

export const Route = createFileRoute("/players/$id")({
  head: () => ({ meta: [{ title: "Player — PPCH" }] }),
  component: PlayerDetail,
});

function PlayerDetail() {
  const { id } = useParams({ from: "/players/$id" });
  const { data: players = [] } = usePlayers();
  const { data: results = [] } = useResults();
  const { data: rounds = [] } = useRounds();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? "฿";

  const player = players.find((p) => p.id === id);
  const myResults = useMemo(
    () => results.filter((r) => r.player_id === id),
    [results, id],
  );

  const enriched = useMemo(() => {
    return myResults.map((r) => {
      const rd = rounds.find((x) => x.id === r.round_id);
      return { ...r, round: rd };
    }).sort((a, b) => +new Date(b.round?.played_at ?? 0) - +new Date(a.round?.played_at ?? 0));
  }, [myResults, rounds]);

  const totals = useMemo(() => {
    const points = myResults.reduce((s, r) => s + r.points_awarded, 0);
    const net = myResults.reduce((s, r) => s + Number(r.net_amount), 0);
    const wins = myResults.filter((r) => r.finish_position === 1).length;
    const rebuys = myResults.reduce((s, r) => s + r.rebuys, 0);
    const top3 = myResults.filter((r) => r.finish_position <= 3).length;
    const avgFinish = myResults.length ? (myResults.reduce((s, r) => s + r.finish_position, 0) / myResults.length).toFixed(1) : "—";
    return { points, net, wins, rebuys, top3, avgFinish, rounds: myResults.length };
  }, [myResults]);

  const finishHistogram = useMemo(() => {
    const counts: Record<number, number> = {};
    myResults.forEach((r) => { counts[r.finish_position] = (counts[r.finish_position] ?? 0) + 1; });
    const max = Math.max(1, ...Object.keys(counts).map(Number));
    return Array.from({ length: max }, (_, i) => ({ position: i + 1, count: counts[i + 1] ?? 0 }));
  }, [myResults]);

  const profitCurve = useMemo(() => {
    const sorted = [...enriched].sort((a, b) => +new Date(a.round?.played_at ?? 0) - +new Date(b.round?.played_at ?? 0));
    let cum = 0;
    return sorted.map((r) => {
      cum += Number(r.net_amount);
      return {
        label: r.round ? format(new Date(r.round.played_at), "MMM d") : "",
        points: r.points_awarded,
        cum,
      };
    });
  }, [enriched]);

  if (!player) {
    return <div className="p-8"><Link to="/players" className="text-primary">← Back</Link><p className="mt-4">Player not found.</p></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/players" className="text-sm text-muted-foreground hover:text-primary">← All players</Link>
      </div>

      <Card>
        <CardContent className="p-6 flex flex-wrap items-center gap-5">
          <div className="size-16 rounded-2xl grid place-items-center text-2xl font-bold text-white" style={{ background: player.avatar_color ?? "#6366f1" }}>
            {player.name.split(" ").map((c) => c[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold">{player.name}</h1>
            {player.nickname && <p className="text-sm text-muted-foreground">{player.nickname}</p>}
          </div>
          {!player.active && <Badge variant="secondary">Inactive</Badge>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Total Points" value={totals.points} />
        <Stat label="Wins" value={totals.wins} />
        <Stat label="Top-3" value={totals.top3} />
        <Stat label="Rounds" value={totals.rounds} />
        <Stat label="Avg Finish" value={totals.avgFinish} />
        <Stat label="Re-buys" value={totals.rebuys} />
        <Stat label="Net" value={`${currency}${totals.net.toLocaleString()}`} positive={totals.net >= 0} negative={totals.net < 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Profit over time</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {profitCurve.length === 0 ? <Empty/> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profitCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="cum" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} name="Net" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Finish position frequency</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {finishHistogram.length === 0 ? <Empty/> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={finishHistogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="position" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Round history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-2 py-2">Round</th>
                  <th className="text-right px-2 py-2">Finish</th>
                  <th className="text-right px-2 py-2">Pts</th>
                  <th className="text-right px-2 py-2">Re-buys</th>
                  <th className="text-right px-2 py-2">Net</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {enriched.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No rounds yet</td></tr>}
                {enriched.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-2 text-muted-foreground">{r.round ? format(new Date(r.round.played_at), "MMM d, yyyy") : "—"}</td>
                    <td className="px-2 py-2 font-medium">{r.round?.name}</td>
                    <td className="px-2 py-2 text-right">#{r.finish_position}</td>
                    <td className="px-2 py-2 text-right font-semibold">{r.points_awarded}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{r.rebuys}</td>
                    <td className={`px-2 py-2 text-right font-mono ${Number(r.net_amount) >= 0 ? "text-success" : "text-destructive"}`}>
                      {Number(r.net_amount) >= 0 ? "+" : ""}{Number(r.net_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.round && <Link to="/rounds/$id" params={{ id: r.round.id }} className="text-primary text-xs hover:underline">View →</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, positive, negative }: { label: string; value: string | number; positive?: boolean; negative?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`text-xl font-bold tabular-nums ${positive ? "text-success" : negative ? "text-destructive" : ""}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="h-full grid place-items-center text-sm text-muted-foreground">No data</div>;
}
