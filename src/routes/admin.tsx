import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAdminUnlocked, setAdminPassword, getAdminPassword } from "@/lib/admin-store";
import {
  verifyAdmin, upsertPlayer, deletePlayer, updateSettings, changeAdminPassword, setPlayerAvatar,
  endSeason, upsertBadge, deleteBadge,
} from "@/lib/api/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { usePlayers, useSettings, useSeasons, useBadges, useRounds, useResults, type Player, type Badge as BadgeT } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Unlock, Plus, Pencil, Trash2, Upload, X, Trophy, Award } from "lucide-react";
import { PlayerAvatar } from "@/components/Avatar";
import { BadgeChip } from "@/components/BadgeChip";
import { format } from "date-fns";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — PPCH" }] }),
  component: AdminPage,
});

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#8b5cf6", "#84cc16", "#f97316", "#14b8a6"];

// Resize image client-side to 256x256 JPEG data URL (~30-60KB)
async function resizeToDataUrl(file: File, max = 256, quality = 0.82): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not load image"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length > 700_000) throw new Error("Image too large after resize — try a simpler photo");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function AdminPage() {
  const unlocked = useAdminUnlocked();
  const verifyFn = useServerFn(verifyAdmin);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const onUnlock = async () => {
    if (!pw) return;
    setLoading(true);
    try {
      await verifyFn({ data: { password: pw } });
      setAdminPassword(pw);
      toast.success("Admin mode unlocked");
      setPw("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="p-4 md:p-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="size-5" /> Admin login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the admin password to edit players, rounds, and settings.
            </p>
            <Input
              type="password"
              placeholder="Admin password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onUnlock()}
            />
            <Button className="w-full btn-glow" onClick={onUnlock} disabled={loading || !pw}>
              {loading ? "Verifying…" : "Unlock"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Unlock className="size-6 text-primary" /> Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage players, settings, and admin password.</p>
        </div>
        <Button variant="ghost" onClick={() => { setAdminPassword(null); toast.success("Locked"); }}>
          <Lock className="size-4 mr-2" /> Lock
        </Button>
      </header>

      <SeasonsAdmin />
      <BadgesAdmin />
      <PlayersAdmin />
      <SettingsAdmin />
      <PasswordAdmin />
    </div>
  );
}

const AUTO_RULES = [
  { v: "season_rank_1", label: "Top of a season" },
  { v: "season_rank_2", label: "Runner-up of a season" },
  { v: "season_rank_3", label: "Third of a season" },
  { v: "first_win", label: "First-ever win" },
  { v: "perfect_attendance", label: "Played every round of a season" },
  { v: "biggest_win", label: "Biggest single-round win of a season" },
  { v: "comeback_win", label: "Won after 2+ rebuys" },
  { v: "most_bubble", label: "Most bubble finishes in a season" },
];

function SeasonsAdmin() {
  const { data: seasons = [] } = useSeasons();
  const { data: rounds = [] } = useRounds();
  const { data: results = [] } = useResults();
  const { data: players = [] } = usePlayers();
  const queryClient = useQueryClient();
  const endFn = useServerFn(endSeason);
  const active = seasons.find((s) => !s.ended_at);
  const past = seasons.filter((s) => s.ended_at);
  const [newName, setNewName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const activeRounds = rounds.filter((r) => r.season_id === active?.id);
  const activeRoundIds = new Set(activeRounds.map((r) => r.id));
  const activeResults = results.filter((r) => activeRoundIds.has(r.round_id));
  const playerCount = new Set(activeResults.map((r) => r.player_id)).size;

  const onEnd = async () => {
    const pw = getAdminPassword();
    if (!pw) return;
    setWorking(true);
    try {
      const res = await endFn({ data: { password: pw, newSeasonName: newName.trim() || undefined } });
      toast.success(`Season closed · ${res.awarded} badges awarded`);
      setConfirmOpen(false);
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      queryClient.invalidateQueries({ queryKey: ["season_standings"] });
      queryClient.invalidateQueries({ queryKey: ["player_badges"] });
      queryClient.invalidateQueries({ queryKey: ["rounds"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-5" /> Seasons</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {active ? (
          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Current active season</div>
                <div className="text-xl font-bold mt-1">{active.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Started {format(new Date(active.started_at), "MMM d, yyyy")} · {activeRounds.length} rounds · {playerCount} players with points
                </div>
              </div>
              <Button className="btn-glow" onClick={() => setConfirmOpen(true)}>
                <Trophy className="size-4 mr-2" /> End season & start new
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active season.</p>
        )}

        {past.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Past seasons</div>
            <div className="space-y-1">
              {past.map((s) => (
                <Link key={s.id} to="/seasons/$id" params={{ id: s.id }} className="flex items-center justify-between p-2 rounded hover:bg-secondary/60 text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(s.started_at), "MMM d, yyyy")} → {s.ended_at ? format(new Date(s.ended_at), "MMM d, yyyy") : "—"} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Dialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>End "{active?.name}"?</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p>This will:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Freeze a final leaderboard for <strong>{active?.name}</strong> ({playerCount} players, {activeRounds.length} rounds).</li>
                <li>Auto-award badges (Champion 🥇, Runner-up 🥈, Bronze 🥉, plus any auto-rule badges).</li>
                <li>Start a fresh season with empty standings (existing rounds stay attached to the old season).</li>
              </ul>
              <div>
                <Label>New season name (optional)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`e.g. ${defaultMonthName()}`} className="mt-1.5" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button onClick={onEnd} disabled={working} className="btn-glow">{working ? "Closing…" : "Confirm & end season"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {players.length === 0 && <p className="text-xs text-muted-foreground">Tip: add players before ending a season.</p>}
      </CardContent>
    </Card>
  );
}

function defaultMonthName() {
  return new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
}

function BadgesAdmin() {
  const { data: badges = [] } = useBadges();
  const queryClient = useQueryClient();
  const upsertFn = useServerFn(upsertBadge);
  const deleteFn = useServerFn(deleteBadge);
  const [editing, setEditing] = useState<Partial<BadgeT> | null>(null);

  const save = async () => {
    const pw = getAdminPassword();
    if (!pw || !editing) return;
    if (!editing.name?.trim()) { toast.error("Name required"); return; }
    if (!editing.icon?.trim()) { toast.error("Icon (emoji) required"); return; }
    try {
      await upsertFn({ data: { password: pw, badge: {
        id: editing.id,
        name: editing.name.trim(),
        icon: editing.icon.trim(),
        color: editing.color ?? "#f59e0b",
        description: editing.description ?? null,
        kind: (editing.kind ?? "manual") as "manual" | "auto",
        auto_rule: editing.auto_rule ?? null,
        sort_order: editing.sort_order ?? 0,
      }}});
      toast.success("Badge saved");
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      setEditing(null);
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (id: string) => {
    const pw = getAdminPassword();
    if (!pw) return;
    if (!confirm("Delete badge? It will be removed from all players who earned it.")) return;
    try {
      await deleteFn({ data: { password: pw, id } });
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      queryClient.invalidateQueries({ queryKey: ["player_badges"] });
      toast.success("Badge deleted");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Award className="size-5" /> Badges</CardTitle>
        <Button size="sm" className="btn-glow" onClick={() => setEditing({ name: "", icon: "🏆", color: "#f59e0b", kind: "manual" })}>
          <Plus className="size-4 mr-1" /> Add badge
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2">Badge</th>
                <th className="text-left px-2 py-2">Type</th>
                <th className="text-left px-2 py-2">Auto rule</th>
                <th className="text-left px-2 py-2">Description</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {badges.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No badges yet</td></tr>}
              {badges.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 flex items-center gap-2 font-medium">
                    <BadgeChip badge={b} size="md" />
                    {b.name}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${b.kind === "auto" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {b.kind}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {b.auto_rule ? AUTO_RULES.find((r) => r.v === b.auto_rule)?.label ?? b.auto_rule : "—"}
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground max-w-[300px] truncate">{b.description ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(b)}><Pencil className="size-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(b.id)}><Trash2 className="size-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit badge" : "Add badge"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <div><Label>Icon</Label><Input value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className="mt-1.5 text-center text-xl" maxLength={4} /></div>
                <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" /></div>
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input type="color" value={editing.color ?? "#f59e0b"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="size-10 rounded border border-border" />
                  <Input value={editing.color ?? ""} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="font-mono" />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Type</Label>
                <div className="flex gap-2 mt-1.5">
                  <button onClick={() => setEditing({ ...editing, kind: "manual", auto_rule: null })} className={`flex-1 px-3 py-2 rounded border text-sm ${editing.kind === "manual" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Manual (admin grants)</button>
                  <button onClick={() => setEditing({ ...editing, kind: "auto" })} className={`flex-1 px-3 py-2 rounded border text-sm ${editing.kind === "auto" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Auto (on season end)</button>
                </div>
              </div>
              {editing.kind === "auto" && (
                <div>
                  <Label>Auto rule</Label>
                  <select
                    value={editing.auto_rule ?? ""}
                    onChange={(e) => setEditing({ ...editing, auto_rule: e.target.value || null })}
                    className="mt-1.5 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="">— Choose a rule —</option>
                    {AUTO_RULES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} className="btn-glow">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PlayersAdmin() {
  const { data: players = [] } = usePlayers();
  const queryClient = useQueryClient();
  const upsertFn = useServerFn(upsertPlayer);
  const deleteFn = useServerFn(deletePlayer);
  const avatarFn = useServerFn(setPlayerAvatar);
  const [editing, setEditing] = useState<Partial<Player> | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const save = async () => {
    const pw = getAdminPassword();
    if (!pw || !editing) return;
    if (!editing.name?.trim()) { toast.error("Name required"); return; }
    try {
      await upsertFn({ data: { password: pw, player: {
        id: editing.id,
        name: editing.name.trim(),
        nickname: editing.nickname ?? null,
        avatar_color: editing.avatar_color ?? "#6366f1",
        avatar_url: editing.avatar_url ?? null,
        active: editing.active ?? true,
      }}});
      toast.success("Player saved");
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    const pw = getAdminPassword();
    if (!pw) return;
    if (!confirm("Delete player? Their round results will also be removed.")) return;
    try {
      await deleteFn({ data: { password: pw, id } });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["results"] });
      toast.success("Player deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleUpload = async (playerId: string, file: File | null) => {
    if (!file) return;
    const pw = getAdminPassword();
    if (!pw) return;
    setUploading(playerId);
    try {
      const dataUrl = await resizeToDataUrl(file);
      await avatarFn({ data: { password: pw, id: playerId, avatar_url: dataUrl } });
      toast.success("Avatar updated");
      queryClient.invalidateQueries({ queryKey: ["players"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const removeAvatar = async (playerId: string) => {
    const pw = getAdminPassword();
    if (!pw) return;
    try {
      await avatarFn({ data: { password: pw, id: playerId, avatar_url: null } });
      toast.success("Avatar removed");
      queryClient.invalidateQueries({ queryKey: ["players"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Players</CardTitle>
        <Button size="sm" className="btn-glow" onClick={() => setEditing({ name: "", avatar_color: COLORS[Math.floor(Math.random()*COLORS.length)], active: true })}>
          <Plus className="size-4 mr-1" /> Add player
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2">Player</th>
                <th className="text-left px-2 py-2">Nickname</th>
                <th className="text-left px-2 py-2">Photo</th>
                <th className="text-left px-2 py-2">Status</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No players yet</td></tr>}
              {players.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium flex items-center gap-2">
                    <PlayerAvatar player={p} size="md" />
                    {p.name}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{p.nickname ?? "—"}</td>
                  <td className="px-2 py-2">
                    <input
                      ref={(el) => { fileInputs.current[p.id] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleUpload(p.id, e.target.files?.[0] ?? null)}
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => fileInputs.current[p.id]?.click()}
                        disabled={uploading === p.id}
                      >
                        <Upload className="size-3 mr-1" />
                        {uploading === p.id ? "…" : p.avatar_url ? "Replace" : "Upload"}
                      </Button>
                      {p.avatar_url && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeAvatar(p.id)}>
                          <X className="size-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs">{p.active ? <span className="text-success">Active</span> : <span className="text-muted-foreground">Inactive</span>}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="size-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="size-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit player" : "Add player"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Nickname (optional)</Label>
                <Input value={editing.nickname ?? ""} onChange={(e) => setEditing({ ...editing, nickname: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Fallback color (used when no photo)</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {COLORS.map((c) => (
                    <button key={c}
                      onClick={() => setEditing({ ...editing, avatar_color: c })}
                      className={`size-8 rounded-full transition-transform ${editing.avatar_color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                Active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} className="btn-glow">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SettingsAdmin() {
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateSettings);
  const [pointsStr, setPointsStr] = useState("");
  const [buyIn, setBuyIn] = useState(0);
  const [rebuy, setRebuy] = useState(0);
  const [levelMin, setLevelMin] = useState(15);
  const [sb, setSb] = useState(25);
  const [bb, setBb] = useState(50);
  const [mult, setMult] = useState(1.5);
  const [currency, setCurrency] = useState("฿");

  useEffect(() => {
    if (!settings) return;
    setPointsStr(settings.point_system.join(","));
    setBuyIn(Number(settings.default_buy_in));
    setRebuy(Number(settings.default_rebuy));
    setLevelMin(settings.default_level_minutes);
    setSb(settings.default_starting_sb);
    setBb(settings.default_starting_bb);
    setMult(Number(settings.default_blind_multiplier));
    setCurrency(settings.currency);
  }, [settings]);


  const save = async () => {
    const pw = getAdminPassword();
    if (!pw) return;
    const point_system = pointsStr.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n >= 0);
    if (point_system.length === 0) { toast.error("Invalid point system"); return; }
    try {
      await updateFn({ data: { password: pw, settings: {
        point_system,
        default_buy_in: buyIn,
        default_rebuy: rebuy,
        default_level_minutes: levelMin,
        default_starting_sb: sb,
        default_starting_bb: bb,
        default_blind_multiplier: mult,
        currency,
      }}});
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Point system (comma-separated)</Label>
          <Input value={pointsStr} onChange={(e) => setPointsStr(e.target.value)} className="mt-1.5 font-mono" />
          <p className="text-xs text-muted-foreground mt-1">Positions beyond this list award 0 points.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label>Currency</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className="mt-1.5" /></div>
          <div><Label>Default buy-in</Label><Input type="number" value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value))} className="mt-1.5" /></div>
          <div><Label>Default re-buy</Label><Input type="number" value={rebuy} onChange={(e) => setRebuy(Number(e.target.value))} className="mt-1.5" /></div>
          <div><Label>Level minutes</Label><Input type="number" value={levelMin} onChange={(e) => setLevelMin(Number(e.target.value))} className="mt-1.5" /></div>
          <div><Label>Starting SB</Label><Input type="number" value={sb} onChange={(e) => setSb(Number(e.target.value))} className="mt-1.5" /></div>
          <div><Label>Starting BB</Label><Input type="number" value={bb} onChange={(e) => setBb(Number(e.target.value))} className="mt-1.5" /></div>
          <div><Label>Blind multiplier</Label><Input type="number" step="0.1" value={mult} onChange={(e) => setMult(Number(e.target.value))} className="mt-1.5" /></div>
        </div>
        <Button onClick={save} className="btn-glow">Save settings</Button>
      </CardContent>
    </Card>
  );
}

function PasswordAdmin() {
  const changeFn = useServerFn(changeAdminPassword);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const save = async () => {
    const pw = getAdminPassword();
    if (!pw) return;
    if (newPw.length < 4) { toast.error("Password too short"); return; }
    if (newPw !== newPw2) { toast.error("Passwords don't match"); return; }
    try {
      await changeFn({ data: { password: pw, newPassword: newPw } });
      setAdminPassword(newPw);
      setNewPw(""); setNewPw2("");
      toast.success("Admin password updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Change admin password</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>New password</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="mt-1.5" /></div>
          <div><Label>Confirm</Label><Input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} className="mt-1.5" /></div>
        </div>
        <Button onClick={save} className="btn-glow">Update password</Button>
      </CardContent>
    </Card>
  );
}
