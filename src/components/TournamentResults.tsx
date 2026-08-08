import { useMemo } from "react";
import { PlayerAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Coins, RotateCcw, Timer } from "lucide-react";
import type { Player } from "@/lib/queries";

export type ResultRow = {
  player: Player;
  position: number;
  payout: number;
  points?: number;
  rebuys: number;
  buyInCost: number;
  bustSb: number | null;
  bustBb: number | null;
  bustTimeSeconds: number | null;
};

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: ((i * 13) % 30) / 10,
        duration: 2.6 + ((i * 7) % 20) / 10,
        drift: (((i * 29) % 200) - 100) + "px",
        color: ["var(--primary)", "var(--accent)", "var(--ink)", "var(--success)"][i % 4],
        size: 6 + (i % 4) * 3,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            ["--drift" as string]: p.drift,
            animation: `confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function fmtTime(sec: number | null) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TournamentResults({
  rows,
  currency,
  pot,
  rake,
  totalRebuys,
  durationSeconds,
  onKeepPlaying,
  onSave,
  saveLabel = "Save round",
}: {
  rows: ResultRow[];
  currency: string;
  pot: number;
  rake: number;
  totalRebuys: number;
  durationSeconds: number;
  onKeepPlaying?: () => void;
  onSave: () => void;
  saveLabel?: string;
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => a.position - b.position), [rows]);
  const podium = [sorted[1], sorted[0], sorted[2]].filter(Boolean); // 2 - 1 - 3
  const heights = ["h-24", "h-36", "h-16"];
  const money = (n: number) => `${currency}${Math.round(n).toLocaleString()}`;

  return (
    <div className="relative">
      <Confetti />

      <div className="relative text-center pt-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground">
          <Trophy className="size-3.5" /> Tournament complete
        </div>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold">Congratulations!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {sorted[0]?.player.name} takes it down after {fmtTime(durationSeconds)} of play.
        </p>
      </div>

      {/* PODIUM */}
      <div className="relative mt-6 grid grid-cols-3 items-end gap-3 md:gap-5">
        {podium.map((r, i) => {
          const place = r.position;
          return (
            <div
              key={r.player.id}
              className="flex flex-col items-center"
              style={{ animation: `podium-rise 520ms cubic-bezier(0.34,1.4,0.64,1) ${i * 120}ms both` }}
            >
              <PlayerAvatar
                player={r.player}
                size={place === 1 ? "xl" : "lg"}
                className={`rounded-2xl ring-4 ${place === 1 ? "ring-accent" : "ring-border"}`}
              />
              <div className="mt-2 text-sm font-semibold text-center leading-tight">{r.player.name}</div>
              <div className="text-xs text-muted-foreground">{money(r.payout)}</div>
              <div
                className={`${heights[i]} mt-2 w-full rounded-t-2xl grid place-items-center ${
                  place === 1 ? "ink-card" : "bg-secondary"
                }`}
              >
                <span className={`text-3xl font-bold ${place === 1 ? "text-accent" : "text-muted-foreground"}`}>
                  {place}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* TOTALS */}
      <div className="relative mt-5 grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Stat icon={Coins} label="Total pot" value={money(pot)} />
        <Stat icon={Coins} label="Rake" value={money(rake)} />
        <Stat icon={RotateCcw} label="Re-buys" value={String(totalRebuys)} />
        <Stat icon={Timer} label="Duration" value={fmtTime(durationSeconds)} />
      </div>

      {/* TABLE */}
      <div className="relative mt-5 rounded-2xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto max-h-[36vh]">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground bg-secondary/60">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-2 py-2">Player</th>
                <th className="text-right px-2 py-2">Payout</th>
                <th className="text-right px-2 py-2">Re-buys</th>
                <th className="text-right px-2 py-2">Net</th>
                <th className="text-right px-3 py-2">Bust SB/BB</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const net = r.payout - r.buyInCost;
                return (
                  <tr key={r.player.id} className="border-t border-border">
                    <td className="px-3 py-2 font-bold tabular-nums">{r.position}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar player={r.player} size="sm" />
                        <span className="font-medium">{r.player.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(r.payout)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.rebuys}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-medium ${net >= 0 ? "text-success" : "text-destructive"}`}>
                      {net >= 0 ? "+" : ""}
                      {Math.round(net).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                      {r.bustSb != null && r.bustBb != null ? `${r.bustSb}/${r.bustBb}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap justify-end gap-2">
        {onKeepPlaying && (
          <Button variant="outline" onClick={onKeepPlaying}>
            Keep playing
          </Button>
        )}
        <Button className="btn-glow" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" /> {label}
      </div>
      <div className="text-lg font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
