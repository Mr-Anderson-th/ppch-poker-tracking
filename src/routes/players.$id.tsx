import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  usePlayers, useResults, useRounds, useSettings, useBadges, usePlayerBadges, useSeasons,
} from "@/lib/queries";
import { format } from "date-fns";
import { PlayerAvatar } from "@/components/Avatar";
import { BadgeChip } from "@/components/BadgeChip";
import { PlayerRadar } from "@/components/PlayerRadar";
import { computePlayerAxes } from "@/lib/points";
import { useAdminUnlocked, getAdminPassword } from "@/lib/admin-store";
import { useServerFn } from "@tanstack/react-start";
import { grantBadge, revokeBadge } from "@/lib/api/admin.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, TrendingUp, TrendingDown, Minus } from "lucide-react";

const searchSchema = z.object({
  season: fallback(z.string(), "__all").default("__all"),
});

export const Route = createFileRoute("/players/$id")({
  head: () => ({ meta: [{ title: "Player — PPCH" }] }),
  validateSearch: zodValidator(searchSchema),
  component: PlayerDetail,
});

function PlayerDetail() {
  const { id } = useParams({ from: "/players/$id" });
  const { season: seasonFromUrl } = useSearch({ from: "/players/$id" });
  const [seasonFilter, setSeasonFilter] = useState<string>(seasonFromUrl);

  const { data: players = [] } = usePlayers();
  const { data: allResults = [] } = useResults();
  const { data: allRounds = [] } = useRounds();
  const { data: settings } = useSettings();
  const { data: badges = [] } = useBadges();
  const { data: playerBadges = [] } = usePlayerBadges();
  const { data: seasons = [] } = useSeasons();
  const currency = settings?.currency ?? "฿";
  const unlocked = useAdminUnlocked();
  const [grantOpen, setGrantOpen] = useState(false);
  const queryClient = useQueryClient();
  const grantFn = useServerFn(grantBadge);
  const revokeFn = useServerFn(revokeBadge);

  const activeSeason = useMemo(() => seasons.find((s) => !s.ended_at), [seasons]);
  const effectiveSeasonId =
    seasonFilter === "__active" ? activeSeason?.id ?? null : seasonFilter === "__all" ? null : seasonFilter;

  const rounds = useMemo(
    () => (effectiveSeasonId ? allRounds.filter((r) => r.season_id === effectiveSeasonId) : allRounds),
    [allRounds, effectiveSeasonId],
  );
  const roundIdSet = useMemo(() => new Set(rounds.map((r) => r.id)), [rounds]);
  const results = useMemo(
    () => (effectiveSeasonId ? allResults.filter((r) => roundIdSet.has(r.round_id)) : allResults),
    [allResults, roundIdSet, effectiveSeasonId],
  );

  const player = players.find((p) => p.id === id);
  const myResults = useMemo(() => results.filter((r) => r.player_id === id), [results, id]);
  const badgeById = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);
  const seasonById = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);
  const myBadges = useMemo(() => playerBadges.filter((pb) => pb.player_id === id), [playerBadges, id]);

  const enriched = useMemo(() => {
    return myResults
      .map((r) => ({ ...r, round: rounds.find((x) => x.id === r.round_id) }))
      .sort((a, b) => +new Date(b.round?.played_at ?? 0) - +new Date(a.round?.played_at ?? 0));
  }, [myResults, rounds]);

  // ---- Player metrics (KPI cards) ----
  const my = useMemo(() => {
    const n = myResults.length;
    const wins = myResults.filter((r) => r.finish_position === 1).length;
    const itm = myResults.filter((r) => Number(r.payout) > 0).length;
    const points = myResults.reduce((s, r) => s + r.points_awarded, 0);
    const money = myResults.reduce((s, r) => s + Number(r.payout), 0);
    const net = myResults.reduce((s, r) => s + Number(r.net_amount), 0);
    const rebuys = myResults.reduce((s, r) => s + r.rebuys, 0);
    return {
      rounds: n,
      itmRate: n ? (itm / n) * 100 : 0,
      winRate: n ? (wins / n) * 100 : 0,
      wins,
      points,
      money,
      net,
      avgRebuy: n ? rebuys / n : 0,
    };
  }, [myResults]);

  // Group average across other players (in same season scope)
  const groupAvg = useMemo(() => {
    const perPlayer = new Map<string, { rounds: number; wins: number; itm: number; points: number; money: number; rebuys: number }>();
    for (const r of results) {
      let a = perPlayer.get(r.player_id);
      if (!a) { a = { rounds: 0, wins: 0, itm: 0, points: 0, money: 0, rebuys: 0 }; perPlayer.set(r.player_id, a); }
      a.rounds += 1;
      if (r.finish_position === 1) a.wins += 1;
      if (Number(r.payout) > 0) a.itm += 1;
      a.points += r.points_awarded;
      a.money += Number(r.payout);
      a.rebuys += r.rebuys;
    }
    // exclude current player from average
    perPlayer.delete(id);
    const arr = Array.from(perPlayer.values()).filter((m) => m.rounds > 0);
    if (arr.length === 0) return null;
    const avg = (fn: (m: typeof arr[number]) => number) => arr.reduce((s, m) => s + fn(m), 0) / arr.length;
    return {
      itmRate: avg((m) => (m.itm / m.rounds) * 100),
      winRate: avg((m) => (m.wins / m.rounds) * 100),
      rounds: avg((m) => m.rounds),
      points: avg((m) => m.points),
      money: avg((m) => m.money),
      avgRebuy: avg((m) => m.rebuys / m.rounds),
    };
  }, [results, id]);

  // ---- Radar axes ----
  const axes = useMemo(() => computePlayerAxes(id, rounds, results), [id, rounds, results]);
  const compareAxes = useMemo(() => {
    // Average axes across all other players who have rounds
    const others = players.filter((p) => p.id !== id);
    const per = others.map((p) => computePlayerAxes(p.id, rounds, results));
    const withData = per.filter((a) => a.survival + a.efficiency + a.aggression + a.potDominance + a.consistency > 0);
    if (withData.length === 0) return undefined;
    const avg = (k: keyof typeof axes) => withData.reduce((s, a) => s + a[k], 0) / withData.length;
    return {
      survival: avg("survival"),
      efficiency: avg("efficiency"),
      aggression: avg("aggression"),
      potDominance: avg("potDominance"),
      consistency: avg("consistency"),
    };
  }, [players, id, rounds, results, axes]);

  if (!player) {
    return (
      <div className="p-8">
        <Link to="/players" className="text-primary">← Back</Link>
        <p className="mt-4">Player not found.</p>
      </div>
    );
  }

  const seasonLabel =
    seasonFilter === "__all"
      ? "All-time"
      : seasonFilter === "__active"
        ? activeSeason?.name ?? "Active"
        : seasons.find((s) => s.id === seasonFilter)?.name ?? "Season";

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/players" className="text-sm text-muted-foreground hover:text-primary">← All players</Link>
      </div>

      {/* HEADER */}
      <Card className="felt overflow-hidden">
        <CardContent className="p-6 flex flex-wrap items-center gap-5">
          <PlayerAvatar player={player} size="xl" className="rounded-2xl ring-2 ring-primary/40 shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_40%,transparent)]" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 flex-wrap">
              <span>{player.name}</span>
              {!player.active && <Badge variant="secondary">Inactive</Badge>}
            </h1>
            {player.nickname && <p className="text-sm text-muted-foreground">"{player.nickname}"</p>}
            {myBadges.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {myBadges.map((pb) => {
                  const b = badgeById.get(pb.badge_id);
                  if (!b) return null;
                  const s = pb.season_id ? seasonById.get(pb.season_id) : null;
                  const tip = pb.note ?? (s ? `${b.name} · ${s.name}` : b.description ?? undefined);
                  return (
                    <span key={pb.id} className="inline-flex items-center gap-0.5 group/badge relative">
                      <BadgeChip badge={b} tooltip={tip ?? undefined} size="sm" />
                      {unlocked && (
                        <button
                          onClick={async () => {
                            const pw = getAdminPassword();
                            if (!pw) return;
                            if (!confirm(`Revoke "${b.name}"?`)) return;
                            try {
                              await revokeFn({ data: { password: pw, id: pb.id } });
                              queryClient.invalidateQueries({ queryKey: ["player_badges"] });
                              toast.success("Badge revoked");
                            } catch (e) { toast.error((e as Error).message); }
                          }}
                          className="opacity-0 group-hover/badge:opacity-100 transition-opacity text-destructive"
                          title="Revoke badge"
                        ><X className="size-3" /></button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All-time</SelectItem>
                {activeSeason && <SelectItem value="__active">Active: {activeSeason.name}</SelectItem>}
                {seasons.filter((s) => s.ended_at).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unlocked && (
              <Button variant="outline" size="sm" onClick={() => setGrantOpen(true)}>
                <Plus className="size-4 mr-1" /> Grant badge
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs uppercase tracking-widest text-muted-foreground">Showing: <span className="text-primary font-semibold">{seasonLabel}</span></div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="ITM Rate" value={`${my.itmRate.toFixed(1)}%`} raw={my.itmRate} avg={groupAvg?.itmRate} betterWhen="higher" />
        <KpiCard label={`Win Rate (${my.wins})`} value={`${my.winRate.toFixed(1)}%`} raw={my.winRate} avg={groupAvg?.winRate} betterWhen="higher" />
        <KpiCard label="Rounds" value={my.rounds} raw={my.rounds} avg={groupAvg?.rounds} betterWhen="higher" />
        <KpiCard label="Points" value={my.points} raw={my.points} avg={groupAvg?.points} betterWhen="higher" />
        <KpiCard label="Money Won" value={`${currency}${Math.round(my.money).toLocaleString()}`} raw={my.money} avg={groupAvg?.money} betterWhen="higher" />
        <KpiCard label="Avg Re-buy" value={my.avgRebuy.toFixed(2)} raw={my.avgRebuy} avg={groupAvg?.avgRebuy} betterWhen="lower" />
      </div>

      {/* RADAR */}
      {my.rounds === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No rounds played in this scope yet.</CardContent></Card>
      ) : (
        <PlayerRadar axes={axes} compareAxes={compareAxes} />
      )}

      {/* GRANT DIALOG */}
      {grantOpen && unlocked && (
        <Dialog open={grantOpen} onOpenChange={(o) => !o && setGrantOpen(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Grant badge to {player.name}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
              {badges.map((b) => (
                <button
                  key={b.id}
                  onClick={async () => {
                    const pw = getAdminPassword();
                    if (!pw) return;
                    try {
                      await grantFn({ data: { password: pw, player_id: player.id, badge_id: b.id, season_id: effectiveSeasonId ?? null, note: null } });
                      queryClient.invalidateQueries({ queryKey: ["player_badges"] });
                      toast.success(`Granted "${b.name}"`);
                      setGrantOpen(false);
                    } catch (e) { toast.error((e as Error).message); }
                  }}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary hover:bg-secondary/60 transition-all text-left"
                >
                  <BadgeChip badge={b} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{b.name}</div>
                    {b.description && <div className="text-[11px] text-muted-foreground line-clamp-2">{b.description}</div>}
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* RECENT ROUNDS */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent rounds</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-2 py-2">Round</th>
                  <th className="text-right px-2 py-2">Finish</th>
                  <th className="text-right px-2 py-2">Pts</th>
                  <th className="text-right px-2 py-2">Payout</th>
                  <th className="text-right px-2 py-2">Net</th>
                  <th className="text-right px-2 py-2">Re-buys</th>
                  <th className="text-right px-2 py-2">Bust BB</th>
                  <th className="text-right px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {enriched.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No rounds yet</td></tr>}
                {enriched.slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-2 text-muted-foreground">{r.round ? format(new Date(r.round.played_at), "MMM d, yyyy") : "—"}</td>
                    <td className="px-2 py-2 font-medium">
                      {r.round && (
                        <Link to="/rounds/$id" params={{ id: r.round.id }} className="hover:text-primary">
                          {r.round.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className={`inline-grid place-items-center size-6 rounded text-xs font-bold ${r.finish_position === 1 ? "bg-warning/20 text-warning" : r.finish_position <= 3 ? "bg-info/15 text-info" : "bg-secondary text-muted-foreground"}`}>
                        {r.finish_position}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{r.points_awarded}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{currency}{Math.round(Number(r.payout)).toLocaleString()}</td>
                    <td className={`px-2 py-2 text-right font-mono ${Number(r.net_amount) >= 0 ? "text-success" : "text-destructive"}`}>
                      {Number(r.net_amount) >= 0 ? "+" : ""}{Number(r.net_amount).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{r.rebuys}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{r.bust_bb ?? "—"}</td>
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

function KpiCard({
  label, value, raw, avg, betterWhen,
}: {
  label: string;
  value: string | number;
  raw: number;
  avg: number | undefined;
  betterWhen: "higher" | "lower";
}) {
  const hasAvg = avg != null && avg !== 0;
  const delta = hasAvg ? ((raw - avg) / Math.abs(avg)) * 100 : null;
  const isBetter = delta == null ? null : betterWhen === "higher" ? delta >= 0 : delta <= 0;
  const Icon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const color = isBetter == null ? "text-muted-foreground" : isBetter ? "text-success" : "text-destructive";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl md:text-2xl font-bold tabular-nums mt-1">{value}</div>
        <div className={`flex items-center gap-1 mt-1 text-[11px] ${color}`}>
          <Icon className="size-3" />
          {delta == null ? (
            <span>—</span>
          ) : (
            <span className="tabular-nums font-semibold">
              {delta > 0 ? "+" : ""}{delta.toFixed(1)}% <span className="text-muted-foreground font-normal">vs avg</span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
