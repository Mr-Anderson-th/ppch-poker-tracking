import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRound, useRoundResults, usePlayers, useSettings } from "@/lib/queries";
import { format } from "date-fns";
import { useAdminUnlocked, getAdminPassword } from "@/lib/admin-store";
import { deleteRound } from "@/lib/api/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { buildBlindLevels } from "@/lib/points";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/rounds/$id")({
  head: () => ({ meta: [{ title: "Round — PPCH" }] }),
  component: RoundDetail,
});

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

  const playerById = new Map(players.map((p) => [p.id, p]));

  if (!round) return <div className="p-8"><Link to="/rounds" className="text-primary">← Back</Link><p className="mt-4">Loading…</p></div>;

  const blindProgression = buildBlindLevels(round.starting_sb, round.starting_bb, Number(round.blind_multiplier), 12);

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

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/rounds" className="text-sm text-muted-foreground hover:text-primary">← All rounds</Link>
        {unlocked && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
            <Trash2 className="size-4 mr-2" /> Delete round
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{round.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{format(new Date(round.played_at), "EEEE, MMM d yyyy · HH:mm")}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">{currency}{Number(round.total_pot).toLocaleString()}</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Final standings</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-2 py-2">Player</th>
                  <th className="text-right px-2 py-2">Pts</th>
                  <th className="text-right px-2 py-2">Re-buys</th>
                  <th className="text-right px-2 py-2">Bust @</th>
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
                            <span className="size-6 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: p.avatar_color ?? "#6366f1" }}>
                              {p.name.split(" ").map((c) => c[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                            {p.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">{r.points_awarded}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{r.rebuys}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground text-xs">
                        {r.finish_position === 1 ? "—" : r.bust_sb && r.bust_bb ? `${r.bust_sb}/${r.bust_bb}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">{currency}{Number(r.payout).toLocaleString()}</td>
                      <td className={`px-4 py-2 text-right font-mono ${Number(r.net_amount) >= 0 ? "text-success" : "text-destructive"}`}>
                        {Number(r.net_amount) >= 0 ? "+" : ""}{Number(r.net_amount).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
