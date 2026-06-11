import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlayers, useResults, useRounds, useSettings } from "@/lib/queries";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarAngleAxis, PolarGrid, PolarRadiusAxis } from "recharts";
import { format } from "date-fns";
import { PlayerAvatar } from "@/components/Avatar";

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
  const myResults = useMemo(() => results.filter((r) => r.player_id === id), [results, id]);

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
    const totalCost = enriched.reduce((s, r) => s + (Number(r.round?.buy_in ?? 0) + r.rebuys * Number(r.round?.rebuy_amount ?? 0)), 0);
    const totalPayout = myResults.reduce((s, r) => s + Number(r.payout), 0);
    const roi = totalCost > 0 ? (net / totalCost) * 100 : 0;
    const itm = myResults.filter((r) => Number(r.payout) > 0).length;
    return { points, net, wins, rebuys, top3, avgFinish, rounds: myResults.length, totalCost, totalPayout, roi, itm };
  }, [myResults, enriched]);

  // Percentages
  const pct = useMemo(() => {
    const n = totals.rounds || 1;
    const totalPoints = results.reduce((s, r) => s + r.points_awarded, 0) || 1;
    return {
      winRate: (totals.wins / n) * 100,
      top3Rate: (totals.top3 / n) * 100,
      itmRate: (totals.itm / n) * 100,
      pointsShare: (totals.points / totalPoints) * 100,
    };
  }, [totals, results]);

  // Bust-level histogram
  const bustLevelHist = useMemo(() => {
    const counts: Record<number, number> = {};
    myResults.forEach((r) => {
      if (r.bust_level != null) counts[r.bust_level] = (counts[r.bust_level] ?? 0) + 1;
    });
    const max = Math.max(1, ...Object.keys(counts).map(Number));
    return Array.from({ length: max }, (_, i) => ({ level: i + 1, count: counts[i + 1] ?? 0 }));
  }, [myResults]);

  // Avg survival time
  const avgSurvivalSec = useMemo(() => {
    const xs = myResults.map((r) => r.bust_time_seconds).filter((x): x is number => x != null);
    if (xs.length === 0) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }, [myResults]);
  const groupAvgSurvivalSec = useMemo(() => {
    const xs = results.map((r) => r.bust_time_seconds).filter((x): x is number => x != null);
    if (xs.length === 0) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }, [results]);

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

  // Rolling avg finish (last 5)
  const rollingFinish = useMemo(() => {
    const sorted = [...enriched].sort((a, b) => +new Date(a.round?.played_at ?? 0) - +new Date(b.round?.played_at ?? 0));
    return sorted.map((r, i) => {
      const window = sorted.slice(Math.max(0, i - 4), i + 1);
      const avg = window.reduce((s, x) => s + x.finish_position, 0) / window.length;
      return {
        label: r.round ? format(new Date(r.round.played_at), "MMM d") : "",
        finish: r.finish_position,
        avg5: Number(avg.toFixed(2)),
      };
    });
  }, [enriched]);

  // Group averages for radar
  const groupComp = useMemo(() => {
    const playerIds = new Set(players.map((p) => p.id));
    const perPlayer = new Map<string, { rounds: number; wins: number; top3: number; cost: number; payout: number; survival: number; surviveN: number; rebuys: number }>();
    for (const pid of playerIds) perPlayer.set(pid, { rounds: 0, wins: 0, top3: 0, cost: 0, payout: 0, survival: 0, surviveN: 0, rebuys: 0 });
    for (const r of results) {
      const m = perPlayer.get(r.player_id); if (!m) continue;
      const rd = rounds.find((x) => x.id === r.round_id);
      m.rounds++;
      if (r.finish_position === 1) m.wins++;
      if (r.finish_position <= 3) m.top3++;
      m.cost += Number(rd?.buy_in ?? 0) + r.rebuys * Number(rd?.rebuy_amount ?? 0);
      m.payout += Number(r.payout);
      m.rebuys += r.rebuys;
      if (r.bust_time_seconds != null) { m.survival += r.bust_time_seconds; m.surviveN++; }
    }
    const arr = Array.from(perPlayer.values()).filter((m) => m.rounds > 0);
    if (arr.length === 0) return null;
    return {
      roi: arr.reduce((s, m) => s + (m.cost > 0 ? ((m.payout - m.cost) / m.cost) * 100 : 0), 0) / arr.length,
      top3Rate: arr.reduce((s, m) => s + (m.top3 / m.rounds) * 100, 0) / arr.length,
      winRate: arr.reduce((s, m) => s + (m.wins / m.rounds) * 100, 0) / arr.length,
      survival: arr.reduce((s, m) => s + (m.surviveN > 0 ? m.survival / m.surviveN : 0), 0) / arr.length,
      rebuysPerRound: arr.reduce((s, m) => s + m.rebuys / m.rounds, 0) / arr.length,
    };
  }, [results, rounds, players]);

  const radarData = useMemo(() => {
    if (!groupComp) return [];
    const norm = (mine: number, grp: number) => {
      if (grp === 0) return mine > 0 ? 100 : 50;
      return Math.max(0, Math.min(100, (mine / grp) * 50));
    };
    return [
      { axis: "Win %", you: norm(pct.winRate, groupComp.winRate), avg: 50 },
      { axis: "Top-3 %", you: norm(pct.top3Rate, groupComp.top3Rate), avg: 50 },
      { axis: "ROI %", you: norm(totals.roi, groupComp.roi || 1), avg: 50 },
      { axis: "Survival", you: norm(avgSurvivalSec ?? 0, groupComp.survival || 1), avg: 50 },
      { axis: "Aggression", you: norm(totals.rebuys / (totals.rounds || 1), groupComp.rebuysPerRound || 0.001), avg: 50 },
    ];
  }, [pct, totals, avgSurvivalSec, groupComp]);

  if (!player) {
    return <div className="p-8"><Link to="/players" className="text-primary">← Back</Link><p className="mt-4">Player not found.</p></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/players" className="text-sm text-muted-foreground hover:text-primary">← All players</Link>
      </div>

      <Card className="felt">
        <CardContent className="p-6 flex flex-wrap items-center gap-5">
          <PlayerAvatar player={player} size="xl" className="rounded-2xl" />
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <PctStat label="Win rate" value={pct.winRate} />
        <PctStat label="Top-3 rate" value={pct.top3Rate} />
        <PctStat label="ITM rate" value={pct.itmRate} />
        <PctStat label="ROI" value={totals.roi} signed />
        <PctStat label="Points share" value={pct.pointsShare} />
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
          <CardHeader><CardTitle className="text-base">Finish position (rolling avg last 5)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {rollingFinish.length === 0 ? <Empty/> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rollingFinish}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis reversed allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="finish" stroke="var(--muted-foreground)" strokeWidth={1} dot={false} name="Finish" />
                    <Line type="monotone" dataKey="avg5" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} name="Rolling avg" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Finish position frequency</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[220px]">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bust blind-level distribution</CardTitle>
            {avgSurvivalSec != null && groupAvgSurvivalSec != null && (
              <p className="text-xs text-muted-foreground">
                Survives ~<strong>{Math.round(avgSurvivalSec / 60)}m</strong> · group avg {Math.round(groupAvgSurvivalSec / 60)}m
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {bustLevelHist.every((x) => x.count === 0) ? <Empty/> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bustLevelHist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="level" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">vs group average</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {radarData.length === 0 || !groupComp ? <Empty/> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Group avg" dataKey="avg" stroke="var(--muted-foreground)" fill="var(--muted-foreground)" fillOpacity={0.15} />
                    <Radar name="You" dataKey="you" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.35} />
                  </RadarChart>
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

function PctStat({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  const cls = signed ? (value >= 0 ? "text-success" : "text-destructive") : "";
  const sign = signed && value > 0 ? "+" : "";
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`text-xl font-bold tabular-nums ${cls}`}>{sign}{value.toFixed(1)}%</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="h-full grid place-items-center text-sm text-muted-foreground">No data</div>;
}
