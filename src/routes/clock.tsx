import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePlayers, useSettings, useRounds, type Player } from "@/lib/queries";
import { buildBlindLevels, PAYOUT_PRESETS, distributePot } from "@/lib/points";
import { saveRound } from "@/lib/api/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Pause, SkipForward, RotateCcw, X, Plus, Check, Coins, ChevronUp, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/clock")({
  head: () => ({ meta: [{ title: "Tournament Clock — PPCH" }] }),
  component: ClockPage,
});

type SeatState = {
  player: Player;
  rebuys: number;
  out: boolean;
  bustPosition: number | null; // 1 = winner
  bustSb: number | null;
  bustBb: number | null;
  bustLevel: number | null;
};

function ClockPage() {
  const { data: players = [] } = usePlayers();
  const { data: settings } = useSettings();
  const { data: rounds = [] } = useRounds();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const saveRoundFn = useServerFn(saveRound);

  // Setup form state
  const defaultName = `Round #${rounds.length + 1} — ${new Date().toLocaleDateString()}`;
  const [name, setName] = useState(defaultName);
  const [buyIn, setBuyIn] = useState(500);
  const [rebuy, setRebuy] = useState(500);
  const [levelMinutes, setLevelMinutes] = useState(15);
  const [startSb, setStartSb] = useState(25);
  const [startBb, setStartBb] = useState(50);
  const [multiplier, setMultiplier] = useState(1.5);
  const [payoutPreset, setPayoutPreset] = useState("50 / 30 / 20");
  const [customPayout, setCustomPayout] = useState("50,30,20");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Apply settings defaults once loaded
  useEffect(() => {
    if (settings) {
      setBuyIn(Number(settings.default_buy_in));
      setRebuy(Number(settings.default_rebuy));
      setLevelMinutes(settings.default_level_minutes);
      setStartSb(settings.default_starting_sb);
      setStartBb(settings.default_starting_bb);
      setMultiplier(Number(settings.default_blind_multiplier));
    }
  }, [settings]);

  useEffect(() => {
    if (name === "Round #1 — " || !name) setName(defaultName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds.length]);

  const payoutStructure = useMemo(() => {
    if (payoutPreset === "Custom") {
      return customPayout
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);
    }
    return PAYOUT_PRESETS[payoutPreset] ?? [100];
  }, [payoutPreset, customPayout]);

  const blindLevels = useMemo(
    () => buildBlindLevels(startSb, startBb, multiplier, 40),
    [startSb, startBb, multiplier],
  );

  // Running state
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(true);
  const [seats, setSeats] = useState<SeatState[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [remaining, setRemaining] = useState(levelMinutes * 60);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const [bustDialog, setBustDialog] = useState<SeatState | null>(null);
  const [endDialog, setEndDialog] = useState(false);

  // Start
  function start() {
    const chosen = players.filter((p) => selectedPlayerIds.includes(p.id));
    if (chosen.length < 2) {
      toast.error("Select at least 2 players");
      return;
    }
    setSeats(
      chosen.map((p) => ({
        player: p, rebuys: 0, out: false, bustPosition: null, bustSb: null, bustBb: null, bustLevel: null,
      })),
    );
    setCurrentLevel(0);
    setRemaining(levelMinutes * 60);
    setElapsedTotal(0);
    setRunning(true);
    setPaused(false);
  }

  function reset() {
    setRunning(false);
    setPaused(true);
    setSeats([]);
    setCurrentLevel(0);
    setRemaining(levelMinutes * 60);
    setElapsedTotal(0);
  }

  // Timer tick
  useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        // level up
        setCurrentLevel((lv) => lv + 1);
        return levelMinutes * 60;
      });
      setElapsedTotal((e) => e + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [running, paused, levelMinutes]);

  // Spacebar pause
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target instanceof HTMLElement && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running]);

  const cur = blindLevels[currentLevel] ?? blindLevels[blindLevels.length - 1];
  const next = blindLevels[currentLevel + 1] ?? cur;

  const activeSeats = seats.filter((s) => !s.out);
  const totalRebuys = seats.reduce((s, x) => s + x.rebuys, 0);
  const pot = seats.length * buyIn + totalRebuys * rebuy;
  const payouts = distributePot(pot, payoutStructure);

  function knockout(seat: SeatState) {
    setBustDialog(seat);
  }

  function confirmBust(seat: SeatState) {
    const nextPos = activeSeats.length; // current alive players count -> this player's finish
    setSeats((prev) =>
      prev.map((s) =>
        s.player.id === seat.player.id
          ? { ...s, out: true, bustPosition: nextPos, bustSb: cur.sb, bustBb: cur.bb, bustLevel: cur.level }
          : s,
      ),
    );
    setBustDialog(null);

    // If 1 left, end tournament
    setTimeout(() => {
      setSeats((prev) => {
        const stillActive = prev.filter((s) => !s.out);
        if (stillActive.length === 1) {
          setEndDialog(true);
        }
        return prev;
      });
    }, 50);
  }

  function addRebuy(seat: SeatState) {
    setSeats((prev) =>
      prev.map((s) => (s.player.id === seat.player.id ? { ...s, rebuys: s.rebuys + 1 } : s)),
    );
  }

  function finalizeAndSave() {
    // Winner = remaining seat
    const winner = seats.find((s) => !s.out);
    if (!winner) return;
    const allSeats = [...seats];
    // Sort by bust position descending — winner gets 1
    const finished = allSeats.map((s) =>
      s.player.id === winner.player.id
        ? { ...s, bustPosition: 1 }
        : s,
    );
    finished.sort((a, b) => (a.bustPosition ?? 99) - (b.bustPosition ?? 99));

    const results = finished.map((s, idx) => ({
      player_id: s.player.id,
      finish_position: s.bustPosition ?? idx + 1,
      rebuys: s.rebuys,
      bust_sb: s.bustSb,
      bust_bb: s.bustBb,
      bust_level: s.bustLevel,
      payout: payouts[(s.bustPosition ?? idx + 1) - 1] ?? 0,
    }));

    toast.promise(
      saveRoundFn({
        data: {
          round: {
            name,
            played_at: new Date().toISOString(),
            buy_in: buyIn,
            rebuy_amount: rebuy,
            payout_structure: payoutStructure,
            level_minutes: levelMinutes,
            blind_multiplier: multiplier,
            starting_sb: startSb,
            starting_bb: startBb,
            duration_seconds: elapsedTotal,
            results,
          },
        },
      }).then((r) => {
        queryClient.invalidateQueries({ queryKey: ["rounds"] });
        queryClient.invalidateQueries({ queryKey: ["results"] });
        navigate({ to: "/rounds/$id", params: { id: r.id } });
      }),
      { loading: "Saving round…", success: "Round saved!", error: (e) => e.message },
    );

    setEndDialog(false);
    reset();
  }

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Tournament Clock</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {running ? `Round in progress · ${activeSeats.length} players remaining` : "Set up your tournament below"}
        </p>
      </header>

      {!running ? (
        <SetupView
          name={name} setName={setName}
          buyIn={buyIn} setBuyIn={setBuyIn}
          rebuy={rebuy} setRebuy={setRebuy}
          levelMinutes={levelMinutes} setLevelMinutes={setLevelMinutes}
          startSb={startSb} setStartSb={setStartSb}
          startBb={startBb} setStartBb={setStartBb}
          multiplier={multiplier} setMultiplier={setMultiplier}
          payoutPreset={payoutPreset} setPayoutPreset={setPayoutPreset}
          customPayout={customPayout} setCustomPayout={setCustomPayout}
          players={players}
          selectedPlayerIds={selectedPlayerIds}
          setSelectedPlayerIds={setSelectedPlayerIds}
          payoutStructure={payoutStructure}
          previewBlinds={blindLevels.slice(0, 6)}
          onStart={start}
          currency={settings?.currency ?? "฿"}
        />
      ) : (
        <RunningView
          name={name}
          remaining={remaining}
          paused={paused}
          setPaused={setPaused}
          cur={cur}
          next={next}
          elapsedTotal={elapsedTotal}
          pot={pot}
          payouts={payouts}
          seats={seats}
          totalRebuys={totalRebuys}
          onKnockout={knockout}
          onRebuy={addRebuy}
          onNextLevel={() => { setCurrentLevel((l) => l + 1); setRemaining(levelMinutes * 60); }}
          onPrevLevel={() => { setCurrentLevel((l) => Math.max(0, l - 1)); setRemaining(levelMinutes * 60); }}
          onReset={reset}
          onEnd={() => setEndDialog(true)}
          currency={settings?.currency ?? "฿"}
        />
      )}

      {/* Bust confirm dialog */}
      <Dialog open={!!bustDialog} onOpenChange={(o) => !o && setBustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Knock out {bustDialog?.player.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Finish position <strong className="text-foreground">#{activeSeats.length}</strong> · busted at
            blinds <strong className="text-foreground">{cur?.sb} / {cur?.bb}</strong> (Level {cur?.level})
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBustDialog(null)}>Cancel</Button>
            <Button onClick={() => bustDialog && confirmBust(bustDialog)}>Confirm knockout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End dialog */}
      <Dialog open={endDialog} onOpenChange={setEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tournament finished</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Final results:</p>
            <ol className="space-y-1">
              {[...seats]
                .sort((a, b) => {
                  const aw = a.out ? 0 : 1;
                  const bw = b.out ? 0 : 1;
                  if (aw !== bw) return bw - aw;
                  return (a.bustPosition ?? 99) - (b.bustPosition ?? 99);
                })
                .map((s, i) => {
                  const pos = !s.out ? 1 : s.bustPosition ?? i + 1;
                  const payout = payouts[pos - 1] ?? 0;
                  return (
                    <li key={s.player.id} className="flex justify-between items-center px-3 py-1.5 rounded bg-secondary/50">
                      <span><strong>#{pos}</strong> {s.player.name}</span>
                      <span className="text-muted-foreground text-xs">{payout > 0 ? `+${payout}` : ""}</span>
                    </li>
                  );
                })}
            </ol>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDialog(false)}>Keep playing</Button>
            <Button onClick={finalizeAndSave}>Save round</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SetupView(props: {
  name: string; setName: (v: string) => void;
  buyIn: number; setBuyIn: (v: number) => void;
  rebuy: number; setRebuy: (v: number) => void;
  levelMinutes: number; setLevelMinutes: (v: number) => void;
  startSb: number; setStartSb: (v: number) => void;
  startBb: number; setStartBb: (v: number) => void;
  multiplier: number; setMultiplier: (v: number) => void;
  payoutPreset: string; setPayoutPreset: (v: string) => void;
  customPayout: string; setCustomPayout: (v: string) => void;
  players: Player[];
  selectedPlayerIds: string[];
  setSelectedPlayerIds: (v: string[] | ((p: string[]) => string[])) => void;
  payoutStructure: number[];
  previewBlinds: { level: number; sb: number; bb: number; ante: number }[];
  onStart: () => void;
  currency: string;
}) {
  const togglePlayer = (id: string) => {
    props.setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Setup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Round name</Label>
            <Input value={props.name} onChange={(e) => props.setName(e.target.value)} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label={`Buy-in (${props.currency})`} value={props.buyIn} onChange={props.setBuyIn} />
            <NumField label={`Re-buy (${props.currency})`} value={props.rebuy} onChange={props.setRebuy} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Level duration</Label>
              <Select value={String(props.levelMinutes)} onValueChange={(v) => props.setLevelMinutes(Number(v))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Blind multiplier</Label>
              <Select value={String(props.multiplier)} onValueChange={(v) => props.setMultiplier(Number(v))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0.5, 1.0, 1.5, 2.0].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m.toFixed(1)}×</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payout</Label>
              <Select value={props.payoutPreset} onValueChange={props.setPayoutPreset}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PAYOUT_PRESETS).map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {props.payoutPreset === "Custom" && (
            <div>
              <Label>Custom payout (% comma-separated)</Label>
              <Input value={props.customPayout} onChange={(e) => props.setCustomPayout(e.target.value)} placeholder="e.g. 50,30,15,5" className="mt-1.5" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Starting SB" value={props.startSb} onChange={props.setStartSb} />
            <NumField label="Starting BB" value={props.startBb} onChange={props.setStartBb} />
          </div>
          <div>
            <Label>Players ({props.selectedPlayerIds.length} selected)</Label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {props.players.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">No players yet. Ask admin to add some.</p>
              )}
              {props.players.map((p) => {
                const active = props.selectedPlayerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                      active
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    <span
                      className="size-6 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: p.avatar_color ?? "#6366f1" }}
                    >
                      {p.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate">{p.name}</span>
                    {active && <Check className="size-4 text-primary ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
          <Button size="lg" className="w-full" onClick={props.onStart} disabled={props.selectedPlayerIds.length < 2}>
            <Play className="size-4 mr-2" /> Start tournament
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Payout preview</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground mb-2">
              Pot estimate (no re-buys): <strong className="text-foreground">{props.currency}{(props.selectedPlayerIds.length * props.buyIn).toLocaleString()}</strong>
            </p>
            <ul className="space-y-1.5">
              {distributePot(props.selectedPlayerIds.length * props.buyIn, props.payoutStructure).map((amt, i) => (
                <li key={i} className="flex justify-between border-b border-border/50 pb-1">
                  <span>#{i + 1}</span>
                  <span className="font-mono">{props.currency}{amt.toLocaleString()} <span className="text-muted-foreground">({props.payoutStructure[i]}%)</span></span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Blind preview</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="text-left pb-1">Lvl</th><th className="text-right pb-1">SB</th><th className="text-right pb-1">BB</th><th className="text-right pb-1">Ante</th></tr>
              </thead>
              <tbody>
                {props.previewBlinds.map((b) => (
                  <tr key={b.level} className="border-t border-border/50">
                    <td className="py-1">{b.level}</td>
                    <td className="py-1 text-right font-mono">{b.sb}</td>
                    <td className="py-1 text-right font-mono">{b.bb}</td>
                    <td className="py-1 text-right font-mono text-muted-foreground">{b.ante || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1.5"
      />
    </div>
  );
}

function RunningView(props: {
  name: string;
  remaining: number;
  paused: boolean;
  setPaused: (p: boolean | ((v: boolean) => boolean)) => void;
  cur: { level: number; sb: number; bb: number; ante: number };
  next: { level: number; sb: number; bb: number; ante: number };
  elapsedTotal: number;
  pot: number;
  payouts: number[];
  seats: SeatState[];
  totalRebuys: number;
  onKnockout: (s: SeatState) => void;
  onRebuy: (s: SeatState) => void;
  onNextLevel: () => void;
  onPrevLevel: () => void;
  onReset: () => void;
  onEnd: () => void;
  currency: string;
}) {
  const total = props.cur ? props.elapsedTotal : 0;
  const totalLevelSeconds = (60 * 60); // for ring scale
  void total; void totalLevelSeconds;

  const min = Math.floor(props.remaining / 60).toString().padStart(2, "0");
  const sec = (props.remaining % 60).toString().padStart(2, "0");

  // Ring progress
  const pct = useMemo(() => {
    const fullLevelSec = props.remaining; // we don't know level minutes here, approximate via 100
    return Math.min(100, Math.max(0, (props.remaining / Math.max(1, props.remaining + 1)) * 100));
  }, [props.remaining]);
  void pct;

  const active = props.seats.filter((s) => !s.out);
  const out = props.seats.filter((s) => s.out).sort((a, b) => (a.bustPosition ?? 0) - (b.bustPosition ?? 0));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Timer hero */}
      <Card className="lg:col-span-2 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-info/5 pointer-events-none" />
        <CardContent className="p-6 md:p-10 relative">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Now playing</div>
              <h2 className="text-xl font-bold">{props.name}</h2>
            </div>
            <Badge variant={props.paused ? "secondary" : "default"} className="text-xs">
              {props.paused ? "PAUSED" : "RUNNING"}
            </Badge>
          </div>

          <div className="flex flex-col items-center py-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Level {props.cur.level} · Blinds</div>
            <div className="text-2xl md:text-3xl font-bold text-primary tabular-nums">
              {props.cur.sb} / {props.cur.bb}
              {props.cur.ante ? <span className="text-sm text-muted-foreground ml-2">+ {props.cur.ante}</span> : null}
            </div>
            <div className="relative my-6">
              <svg className="size-[260px] md:size-[320px] -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle
                  cx="50" cy="50" r="46" fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 46}`}
                  strokeDashoffset={`${2 * Math.PI * 46 * (1 - Math.min(1, props.remaining / (60 * 30)))}`}
                  className="transition-all duration-300"
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="var(--info)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-5xl md:text-7xl font-bold tabular-nums tracking-tighter">
                  {min}:{sec}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Next: {props.next.sb} / {props.next.bb}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="lg" onClick={() => props.setPaused((p) => !p)}>
                {props.paused ? <><Play className="size-4 mr-2" /> Resume</> : <><Pause className="size-4 mr-2" /> Pause</>}
              </Button>
              <Button variant="outline" size="lg" onClick={props.onPrevLevel}><ChevronDown className="size-4" /></Button>
              <Button variant="outline" size="lg" onClick={props.onNextLevel}><ChevronUp className="size-4 mr-1" /> Next level</Button>
              <Button variant="outline" size="lg" onClick={props.onReset}><RotateCcw className="size-4" /></Button>
              <Button variant="destructive" size="lg" onClick={props.onEnd}>End tournament</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Press <kbd className="px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border text-[10px]">Space</kbd> to pause / resume
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-4 text-center">
            <Stat label="Players left" value={active.length} />
            <Stat label="Re-buys" value={props.totalRebuys} />
            <Stat label="Pot" value={`${props.currency}${props.pot.toLocaleString()}`} />
            <Stat label="Elapsed" value={`${Math.floor(props.elapsedTotal / 60)}:${(props.elapsedTotal % 60).toString().padStart(2, "0")}`} />
          </div>
        </CardContent>
      </Card>

      {/* Seats */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Active ({active.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {active.map((s) => (
              <div key={s.player.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-secondary/40">
                <span className="size-7 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0" style={{ background: s.player.avatar_color ?? "#6366f1" }}>
                  {s.player.name.split(" ").map((c) => c[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm font-medium truncate flex-1">{s.player.name}</span>
                {s.rebuys > 0 && <Badge variant="secondary" className="text-[10px]">×{s.rebuys + 1}</Badge>}
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Re-buy" onClick={() => props.onRebuy(s)}>
                  <Plus className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" title="Knock out" onClick={() => props.onKnockout(s)}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {out.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Eliminated</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {out.map((s) => (
                <div key={s.player.id} className="flex items-center gap-2 text-sm">
                  <span className="size-5 rounded text-[10px] font-bold grid place-items-center bg-secondary">{s.bustPosition}</span>
                  <span className="flex-1 truncate text-muted-foreground">{s.player.name}</span>
                  <span className="text-xs text-muted-foreground">{s.bustSb}/{s.bustBb}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Payouts</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {props.payouts.map((amt, i) => (
                <li key={i} className="flex justify-between">
                  <span>#{i + 1}</span>
                  <span className="font-mono">{props.currency}{amt.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
