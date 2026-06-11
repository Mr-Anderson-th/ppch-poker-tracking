import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRound, useRoundResults, usePlayers, useSettings, type RoundResult } from "@/lib/queries";
import { format } from "date-fns";
import { useAdminUnlocked, getAdminPassword } from "@/lib/admin-store";
import { deleteRound, updateRound } from "@/lib/api/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { buildBlindLevels } from "@/lib/points";
import { Trash2, Pencil } from "lucide-react";
import { PlayerAvatar } from "@/components/Avatar";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, ReferenceLine, Cell,
} from "recharts";

export const Route = createFileRoute("/rounds/$id")({
  head: () => ({ meta: [{ title: "Round — PPCH" }] }),
  component: RoundDetail,
});

function fmtMMSS(sec: number | null) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RoundDetail() {
  const { id } = useParams({ from: "/rounds/$id" });
  const { data: round } = useRound(id);
  const { data: results = [] } = useRoundResults(id);
  const { data: players = [] } = usePlayers();
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? "฿";
  const unlocked = useAdminUnlocked();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deleteFn = useServerFn(deleteRound);
  const [editOpen, setEditOpen] = useState(false);

  const playerById = new Map(players.map((p) => [p.id, p]));

  if (!round) return <div className="p-8"><Link to="/rounds" className="text-primary">← Back</Link><p className="mt-4">Loading…</p></div>;

  const blindProgression = buildBlindLevels(round.starting_sb, round.starting_bb, Number(round.blind_multiplier), 12);

  // Timeline data: bust events
  const bustPoints = results
    .filter((r) => r.bust_time_seconds != null && r.finish_position !== 1)
    .map((r) => {
      const p = playerById.get(r.player_id);
      return {
        time: (r.bust_time_seconds ?? 0) / 60, // minutes
        position: r.finish_position,
        name: p?.name ?? "—",
        color: p?.avatar_color ?? "#6366f1",
        rebuys: r.rebuys,
        level: r.bust_level,
      };
    });

  // Rebuy events for timeline overlay
  const rebuyPoints = results.flatMap((r) =>
    (r.rebuy_times ?? []).map((t) => {
      const p = playerById.get(r.player_id);
      return {
        time: t / 60,
        position: r.finish_position,
        name: p?.name ?? "—",
        color: p?.avatar_color ?? "#6366f1",
      };
    }),
  );

  const onDelete = async () => {
    const pw = getAdminPassword();
    if (!pw) return;
    if (!confirm("Delete this round? This cannot be undone.")) return;
    try {
      await deleteFn({ data: { password: pw, id: round.id } });
      toast.success("Round deleted");
      queryClient.invalidateQueries({ queryKey: ["rounds"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      navigate({ to: "/rounds" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const maxTime = Math.max(
    round.duration_seconds / 60,
    ...bustPoints.map((b) => b.time),
    1,
  );

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/rounds" className="text-sm text-muted-foreground hover:text-primary">← All rounds</Link>
        {unlocked && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4 mr-2" /> Edit round
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
              <Trash2 className="size-4 mr-2" /> Delete
            </Button>
          </div>
        )}
      </div>

      <Card className="felt">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{round.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{format(new Date(round.played_at), "EEEE, MMM d yyyy · HH:mm")}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums text-primary">{currency}{Number(round.total_pot).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground uppercase">Total pot</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-5">
            <Mini label="Players" value={round.total_players} />
            <Mini label="Re-buys" value={round.total_rebuys} />
            <Mini label="Buy-in" value={`${currency}${Number(round.buy_in)}`} />
            <Mini label="Re-buy" value={`${currency}${Number(round.rebuy_amount)}`} />
            <Mini label="Level" value={`${round.level_minutes}m`} />
            <Mini label="Duration" value={`${Math.floor(round.duration_seconds / 60)}m`} />
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bust & re-buy timeline</CardTitle>
          <p className="text-xs text-muted-foreground">Each dot = a knockout. Triangles = re-buys. Hover for detail.</p>
        </CardHeader>
        <CardContent>
          {bustPoints.length === 0 && rebuyPoints.length === 0 ? (
            <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">
              No timeline data — use the Clock to record bust/re-buy times automatically, or admin can fill values manually.
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number" dataKey="time"
                    domain={[0, Math.ceil(maxTime)]}
                    tickFormatter={(v) => `${v}m`}
                    tick={{ fontSize: 11 }} stroke="var(--muted-foreground)"
                    label={{ value: "Minutes from start", position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    type="number" dataKey="position"
                    domain={[1, Math.max(round.total_players, 2)]} reversed allowDecimals={false}
                    tick={{ fontSize: 11 }} stroke="var(--muted-foreground)"
                    label={{ value: "Finish position", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <ZAxis range={[80, 160]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(_v, _n, p) => {
                      const d = p.payload as typeof bustPoints[number] & { kind?: string };
                      return [`${d.name} · #${d.position} @ ${d.time.toFixed(1)}m${d.level ? ` (Lv ${d.level})` : ""}`, "Event"];
                    }}
                  />
                  <Scatter name="Bust" data={bustPoints} shape="circle">
                    {bustPoints.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Scatter>
                  <Scatter name="Re-buy" data={rebuyPoints} shape="triangle">
                    {rebuyPoints.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.45} />)}
                  </Scatter>
                  <ReferenceLine x={round.level_minutes} stroke="var(--muted-foreground)" strokeDasharray="2 4" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Final standings</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-2 py-2">Player</th>
                    <th className="text-right px-2 py-2">Pts</th>
                    <th className="text-right px-2 py-2">Re-buys</th>
                    <th className="text-right px-2 py-2">Bust @</th>
                    <th className="text-right px-2 py-2">Time</th>
                    <th className="text-right px-2 py-2">Payout</th>
                    <th className="text-right px-4 py-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const p = playerById.get(r.player_id);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center justify-center size-6 rounded text-xs font-bold ${r.finish_position === 1 ? "bg-warning/20 text-warning" : r.finish_position <= 3 ? "bg-info/20 text-info" : "bg-secondary text-muted-foreground"}`}>
                            {r.finish_position}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {p ? (
                            <Link to="/players/$id" params={{ id: p.id }} className="flex items-center gap-2 hover:text-primary">
                              <PlayerAvatar player={p} size="sm" />
                              {p.name}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold">{r.points_awarded}</td>
                        <td className="px-2 py-2 text-right text-muted-foreground">{r.rebuys}</td>
                        <td className="px-2 py-2 text-right text-muted-foreground text-xs">
                          {r.finish_position === 1 ? "—" : r.bust_sb && r.bust_bb ? `${r.bust_sb}/${r.bust_bb}` : "—"}
                        </td>
                        <td className="px-2 py-2 text-right text-muted-foreground text-xs">{fmtMMSS(r.bust_time_seconds)}</td>
                        <td className="px-2 py-2 text-right font-mono">{currency}{Number(r.payout).toLocaleString()}</td>
                        <td className={`px-4 py-2 text-right font-mono ${Number(r.net_amount) >= 0 ? "text-success" : "text-destructive"}`}>
                          {Number(r.net_amount) >= 0 ? "+" : ""}{Number(r.net_amount).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Payout structure</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <ul className="space-y-1">
                {round.payout_structure.map((pct, i) => (
                  <li key={i} className="flex justify-between"><span>#{i+1}</span><span>{pct}%</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Blind progression</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="text-left pb-1">Lvl</th><th className="text-right pb-1">SB</th><th className="text-right pb-1">BB</th></tr>
                </thead>
                <tbody>
                  {blindProgression.map((b) => (
                    <tr key={b.level} className="border-t border-border/50">
                      <td className="py-1">{b.level}</td>
                      <td className="py-1 text-right font-mono">{b.sb}</td>
                      <td className="py-1 text-right font-mono">{b.bb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground mt-2">×{Number(round.blind_multiplier)} per {round.level_minutes}m level</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {editOpen && (
        <EditRoundDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          round={round}
          results={results}
          players={players}
        />
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function EditRoundDialog({
  open, onClose, round, results, players,
}: {
  open: boolean;
  onClose: () => void;
  round: { id: string; name: string; played_at: string; buy_in: number; rebuy_amount: number; notes: string | null };
  results: RoundResult[];
  players: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateRound);
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "—";

  const [name, setName] = useState(round.name);
  const [playedAt, setPlayedAt] = useState(round.played_at.slice(0, 16));
  const [buyIn, setBuyIn] = useState(Number(round.buy_in));
  const [rebuyAmt, setRebuyAmt] = useState(Number(round.rebuy_amount));
  const [notes, setNotes] = useState(round.notes ?? "");
  const [rows, setRows] = useState(() =>
    results.map((r) => ({
      id: r.id,
      player_id: r.player_id,
      finish_position: r.finish_position,
      rebuys: r.rebuys,
      bust_sb: r.bust_sb,
      bust_bb: r.bust_bb,
      bust_level: r.bust_level,
      bust_time_seconds: r.bust_time_seconds,
      payout: Number(r.payout),
      points_awarded: r.points_awarded,
    })),
  );

  const update = (i: number, patch: Partial<typeof rows[number]>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const save = async () => {
    const pw = getAdminPassword();
    if (!pw) return;
    try {
      await updateFn({
        data: {
          password: pw,
          id: round.id,
          round: {
            name: name.trim(),
            played_at: new Date(playedAt).toISOString(),
            buy_in: buyIn,
            rebuy_amount: rebuyAmt,
            notes: notes.trim() || null,
          },
          results: rows,
        },
      });
      toast.success("Round updated");
      queryClient.invalidateQueries({ queryKey: ["rounds"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      queryClient.invalidateQueries({ queryKey: ["round", round.id] });
      queryClient.invalidateQueries({ queryKey: ["round-results", round.id] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit round</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" /></div>
            <div><Label>Date/time</Label><Input type="datetime-local" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} className="mt-1.5" /></div>
            <div><Label>Buy-in</Label><Input type="number" value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Re-buy amt</Label><Input type="number" value={rebuyAmt} onChange={(e) => setRebuyAmt(Number(e.target.value))} className="mt-1.5" /></div>
            <div className="col-span-full"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" /></div>
          </div>

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-2">Player</th>
                  <th className="px-1 py-2">Pos</th>
                  <th className="px-1 py-2">Re-buys</th>
                  <th className="px-1 py-2">Bust SB</th>
                  <th className="px-1 py-2">Bust BB</th>
                  <th className="px-1 py-2">Bust Lvl</th>
                  <th className="px-1 py-2">Bust sec</th>
                  <th className="px-1 py-2">Payout</th>
                  <th className="px-1 py-2">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-2 py-1 font-medium whitespace-nowrap">{playerName(r.player_id)}</td>
                    <td><NumCell v={r.finish_position} on={(v) => update(i, { finish_position: v ?? 1 })} /></td>
                    <td><NumCell v={r.rebuys} on={(v) => update(i, { rebuys: v ?? 0 })} /></td>
                    <td><NumCell v={r.bust_sb} on={(v) => update(i, { bust_sb: v })} nullable /></td>
                    <td><NumCell v={r.bust_bb} on={(v) => update(i, { bust_bb: v })} nullable /></td>
                    <td><NumCell v={r.bust_level} on={(v) => update(i, { bust_level: v })} nullable /></td>
                    <td><NumCell v={r.bust_time_seconds} on={(v) => update(i, { bust_time_seconds: v })} nullable /></td>
                    <td><NumCell v={r.payout} on={(v) => update(i, { payout: v ?? 0 })} /></td>
                    <td><NumCell v={r.points_awarded} on={(v) => update(i, { points_awarded: v ?? 0 })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Tip: enter bust seconds as elapsed-from-start (e.g. 1830 = 30m30s). Net amount is recalculated automatically.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} className="btn-glow">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumCell({ v, on, nullable }: { v: number | null; on: (v: number | null) => void; nullable?: boolean }) {
  return (
    <input
      type="number"
      value={v ?? ""}
      onChange={(e) => {
        const s = e.target.value;
        if (s === "" && nullable) on(null);
        else on(Number(s) || 0);
      }}
      className="w-20 px-1.5 py-1 rounded bg-background border border-border text-center tabular-nums"
    />
  );
}
