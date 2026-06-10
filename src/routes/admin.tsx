import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useAdminUnlocked, setAdminPassword, getAdminPassword } from "@/lib/admin-store";
import { verifyAdmin, upsertPlayer, deletePlayer, updateSettings, changeAdminPassword } from "@/lib/api/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { usePlayers, useSettings, type Player } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Unlock, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — PPCH" }] }),
  component: AdminPage,
});

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#8b5cf6", "#84cc16", "#f97316", "#14b8a6"];

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
            <Button className="w-full" onClick={onUnlock} disabled={loading || !pw}>
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

      <PlayersAdmin />
      <SettingsAdmin />
      <PasswordAdmin />
    </div>
  );
}

function PlayersAdmin() {
  const { data: players = [] } = usePlayers();
  const queryClient = useQueryClient();
  const upsertFn = useServerFn(upsertPlayer);
  const deleteFn = useServerFn(deletePlayer);
  const [editing, setEditing] = useState<Partial<Player> | null>(null);

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Players</CardTitle>
        <Button size="sm" onClick={() => setEditing({ name: "", avatar_color: COLORS[Math.floor(Math.random()*COLORS.length)], active: true })}>
          <Plus className="size-4 mr-1" /> Add player
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-2 py-2">Nickname</th>
                <th className="text-left px-2 py-2">Color</th>
                <th className="text-left px-2 py-2">Status</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No players yet</td></tr>}
              {players.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium flex items-center gap-2">
                    <span className="size-6 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: p.avatar_color ?? "#6366f1" }}>
                      {p.name.split(" ").map((c) => c[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    {p.name}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{p.nickname ?? "—"}</td>
                  <td className="px-2 py-2"><span className="inline-block size-4 rounded" style={{ background: p.avatar_color ?? "#6366f1" }} /></td>
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
                <Label>Color</Label>
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
            <Button onClick={save}>Save</Button>
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
  const [loaded, setLoaded] = useState(false);

  if (settings && !loaded) {
    setPointsStr(settings.point_system.join(","));
    setBuyIn(Number(settings.default_buy_in));
    setRebuy(Number(settings.default_rebuy));
    setLevelMin(settings.default_level_minutes);
    setSb(settings.default_starting_sb);
    setBb(settings.default_starting_bb);
    setMult(Number(settings.default_blind_multiplier));
    setCurrency(settings.currency);
    setLoaded(true);
  }

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
        <Button onClick={save}>Save settings</Button>
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
        <Button onClick={save}>Update password</Button>
      </CardContent>
    </Card>
  );
}
