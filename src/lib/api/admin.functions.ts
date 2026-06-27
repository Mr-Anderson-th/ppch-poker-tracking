import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function verify(password: string) {
  const sb = await admin();
  const { data, error } = await sb.rpc("verify_admin_password", { _password: password });
  if (error) throw new Error("Could not verify password");
  if (!data) throw new Error("Incorrect admin password");
}

export const verifyAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    await verify(data.password);
    return { ok: true };
  });

const playerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  nickname: z.string().trim().max(60).optional().nullable(),
  avatar_color: z.string().trim().max(20).optional().nullable(),
  avatar_url: z.string().max(500_000).optional().nullable(),
  active: z.boolean().optional(),
});

export const upsertPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; player: z.infer<typeof playerSchema> }) =>
    z.object({ password: z.string().min(1), player: playerSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { player } = data;
    const row = {
      name: player.name,
      nickname: player.nickname ?? null,
      avatar_color: player.avatar_color ?? "#6366f1",
      avatar_url: player.avatar_url ?? null,
      active: player.active ?? true,
    };
    if (player.id) {
      const { error } = await sb.from("players").update(row).eq("id", player.id);
      if (error) throw new Error(error.message);
      return { id: player.id };
    } else {
      const { data: r, error } = await sb.from("players").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      return { id: r.id };
    }
  });

export const setPlayerAvatar = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string; avatar_url: string | null }) =>
    z.object({
      password: z.string().min(1),
      id: z.string().uuid(),
      avatar_url: z.string().max(800_000).nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { error } = await sb.from("players").update({ avatar_url: data.avatar_url }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlayer = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) =>
    z.object({ password: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { error } = await sb.from("players").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const settingsSchema = z.object({
  point_system: z.array(z.number().int().min(0).max(10000)).min(1).max(50).optional(),
  default_buy_in: z.number().min(0).optional(),
  default_rebuy: z.number().min(0).optional(),
  default_level_minutes: z.number().int().min(1).max(120).optional(),
  default_starting_sb: z.number().int().min(1).optional(),
  default_starting_bb: z.number().int().min(1).optional(),
  default_blind_multiplier: z.number().min(0.1).max(10).optional(),
  currency: z.string().max(5).optional(),
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; settings: z.infer<typeof settingsSchema> }) =>
    z.object({ password: z.string().min(1), settings: settingsSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { error } = await sb.from("settings").update(data.settings).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; newPassword: string }) =>
    z.object({ password: z.string().min(1), newPassword: z.string().min(4).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { error } = await sb.rpc("set_admin_password", { _new_password: data.newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const resultSchema = z.object({
  player_id: z.string().uuid(),
  finish_position: z.number().int().min(1).max(100),
  rebuys: z.number().int().min(0).max(50).default(0),
  bust_sb: z.number().int().nullable().optional(),
  bust_bb: z.number().int().nullable().optional(),
  bust_level: z.number().int().nullable().optional(),
  bust_time_seconds: z.number().int().min(0).nullable().optional(),
  rebuy_times: z.array(z.number().int().min(0)).default([]),
  payout: z.number().min(0).default(0),
});

const roundSchema = z.object({
  name: z.string().trim().min(1).max(120),
  played_at: z.string().optional(),
  buy_in: z.number().min(0),
  rebuy_amount: z.number().min(0),
  payout_structure: z.array(z.number().min(0).max(100)).min(1).max(20),
  level_minutes: z.number().int().min(1).max(120),
  blind_multiplier: z.number().min(0.1).max(10),
  starting_sb: z.number().int().min(1),
  starting_bb: z.number().int().min(1),
  duration_seconds: z.number().int().min(0).default(0),
  notes: z.string().max(2000).optional().nullable(),
  results: z.array(resultSchema).min(1).max(100),
});

export const saveRound = createServerFn({ method: "POST" })
  .inputValidator((d: { round: z.infer<typeof roundSchema> }) =>
    z.object({ round: roundSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { round } = data;

    const { data: settings } = await sb.from("settings").select("point_system").eq("id", 1).single();
    const pointSystem: number[] = (settings?.point_system as number[]) ?? [
      100, 75, 60, 50, 40, 30, 25, 20, 15, 10,
    ];

    // Attach to current active season
    const { data: season } = await (sb as any)
      .from("seasons").select("id").is("ended_at", null)
      .order("started_at", { ascending: false }).limit(1).maybeSingle();

    const totalRebuys = round.results.reduce((s, r) => s + (r.rebuys ?? 0), 0);
    const totalPlayers = round.results.length;
    const totalPot = totalPlayers * round.buy_in + totalRebuys * round.rebuy_amount;

    const { data: r, error } = await sb
      .from("rounds")
      .insert({
        name: round.name,
        played_at: round.played_at ?? new Date().toISOString(),
        buy_in: round.buy_in,
        rebuy_amount: round.rebuy_amount,
        payout_structure: round.payout_structure,
        level_minutes: round.level_minutes,
        blind_multiplier: round.blind_multiplier,
        starting_sb: round.starting_sb,
        starting_bb: round.starting_bb,
        total_players: totalPlayers,
        total_rebuys: totalRebuys,
        total_pot: totalPot,
        duration_seconds: round.duration_seconds,
        notes: round.notes ?? null,
        season_id: season?.id ?? null,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const resultsRows = round.results.map((res) => {
      const points = pointSystem[res.finish_position - 1] ?? 0;
      const cost = round.buy_in + (res.rebuys ?? 0) * round.rebuy_amount;
      return {
        round_id: r.id,
        player_id: res.player_id,
        finish_position: res.finish_position,
        rebuys: res.rebuys ?? 0,
        bust_sb: res.bust_sb ?? null,
        bust_bb: res.bust_bb ?? null,
        bust_level: res.bust_level ?? null,
        bust_time_seconds: res.bust_time_seconds ?? null,
        rebuy_times: res.rebuy_times ?? [],
        payout: res.payout,
        net_amount: res.payout - cost,
        points_awarded: points,
      };
    });
    const { error: e2 } = await sb.from("round_results").insert(resultsRows);
    if (e2) {
      await sb.from("rounds").delete().eq("id", r.id);
      throw new Error(e2.message);
    }
    return { id: r.id };
  });

export const deleteRound = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) =>
    z.object({ password: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { error } = await sb.from("rounds").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const editResultSchema = z.object({
  id: z.string().uuid(),
  finish_position: z.number().int().min(1).max(100),
  rebuys: z.number().int().min(0).max(50),
  bust_sb: z.number().int().nullable(),
  bust_bb: z.number().int().nullable(),
  bust_level: z.number().int().nullable(),
  bust_time_seconds: z.number().int().min(0).nullable(),
  payout: z.number().min(0),
  points_awarded: z.number().int().min(0),
});

export const updateRound = createServerFn({ method: "POST" })
  .inputValidator((d: {
    password: string;
    id: string;
    round: { name?: string; played_at?: string; buy_in?: number; rebuy_amount?: number; notes?: string | null };
    results: z.infer<typeof editResultSchema>[];
  }) =>
    z.object({
      password: z.string().min(1),
      id: z.string().uuid(),
      round: z.object({
        name: z.string().trim().min(1).max(120).optional(),
        played_at: z.string().optional(),
        buy_in: z.number().min(0).optional(),
        rebuy_amount: z.number().min(0).optional(),
        notes: z.string().max(2000).nullable().optional(),
      }),
      results: z.array(editResultSchema).min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();

    const { data: existing, error: ge } = await sb.from("rounds").select("buy_in,rebuy_amount").eq("id", data.id).single();
    if (ge) throw new Error(ge.message);
    const buyIn = data.round.buy_in ?? Number(existing.buy_in);
    const rebuyAmt = data.round.rebuy_amount ?? Number(existing.rebuy_amount);

    const totalRebuys = data.results.reduce((s, r) => s + r.rebuys, 0);
    const totalPlayers = data.results.length;
    const totalPot = totalPlayers * buyIn + totalRebuys * rebuyAmt;

    const { error: e1 } = await sb.from("rounds").update({
      ...data.round,
      total_players: totalPlayers,
      total_rebuys: totalRebuys,
      total_pot: totalPot,
    }).eq("id", data.id);
    if (e1) throw new Error(e1.message);

    for (const r of data.results) {
      const cost = buyIn + r.rebuys * rebuyAmt;
      const { error: ue } = await sb.from("round_results").update({
        finish_position: r.finish_position,
        rebuys: r.rebuys,
        bust_sb: r.bust_sb,
        bust_bb: r.bust_bb,
        bust_level: r.bust_level,
        bust_time_seconds: r.bust_time_seconds,
        payout: r.payout,
        net_amount: r.payout - cost,
        points_awarded: r.points_awarded,
      }).eq("id", r.id);
      if (ue) throw new Error(ue.message);
    }
    return { ok: true };
  });

// ========== BADGES ==========

const badgeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().min(1).max(8),
  color: z.string().trim().max(20),
  description: z.string().max(300).optional().nullable(),
  kind: z.enum(["manual", "auto"]),
  auto_rule: z.string().max(60).optional().nullable(),
  sort_order: z.number().int().optional(),
});

export const upsertBadge = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; badge: z.infer<typeof badgeSchema> }) =>
    z.object({ password: z.string().min(1), badge: badgeSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { badge } = data;
    const row = {
      name: badge.name,
      icon: badge.icon,
      color: badge.color,
      description: badge.description ?? null,
      kind: badge.kind,
      auto_rule: badge.kind === "auto" ? (badge.auto_rule ?? null) : null,
      sort_order: badge.sort_order ?? 0,
    };
    if (badge.id) {
      const { error } = await (sb as any).from("badges").update(row).eq("id", badge.id);
      if (error) throw new Error(error.message);
      return { id: badge.id };
    }
    const { data: r, error } = await (sb as any).from("badges").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: r.id };
  });

export const deleteBadge = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) =>
    z.object({ password: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { error } = await (sb as any).from("badges").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantBadge = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; player_id: string; badge_id: string; season_id?: string | null; note?: string | null }) =>
    z.object({
      password: z.string().min(1),
      player_id: z.string().uuid(),
      badge_id: z.string().uuid(),
      season_id: z.string().uuid().nullable().optional(),
      note: z.string().max(200).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { error } = await (sb as any).from("player_badges").upsert({
      player_id: data.player_id,
      badge_id: data.badge_id,
      season_id: data.season_id ?? null,
      note: data.note ?? null,
    }, { onConflict: "player_id,badge_id,season_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeBadge = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) =>
    z.object({ password: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();
    const { error } = await (sb as any).from("player_badges").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========== END SEASON ==========

export const endSeason = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; newSeasonName?: string }) =>
    z.object({
      password: z.string().min(1),
      newSeasonName: z.string().trim().min(1).max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verify(data.password);
    const sb = await admin();

    // Find active season
    const { data: active, error: ae } = await (sb as any)
      .from("seasons").select("*").is("ended_at", null)
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (ae) throw new Error(ae.message);
    if (!active) throw new Error("No active season to end");

    // Pull rounds + results for this season
    const { data: rounds, error: re } = await (sb as any)
      .from("rounds").select("id,total_players,payout_structure").eq("season_id", active.id);
    if (re) throw new Error(re.message);
    const roundIds = (rounds ?? []).map((r: any) => r.id);

    if (roundIds.length === 0) {
      // Just close and open new
      const closed = new Date().toISOString();
      await (sb as any).from("seasons").update({ ended_at: closed }).eq("id", active.id);
      const newName = data.newSeasonName ?? defaultSeasonName();
      const { data: ns, error: ne } = await (sb as any).from("seasons").insert({ name: newName }).select("id").single();
      if (ne) throw new Error(ne.message);
      return { ok: true, closed_season_id: active.id, new_season_id: ns.id, awarded: 0 };
    }

    const { data: results, error: rre } = await (sb as any)
      .from("round_results").select("*").in("round_id", roundIds);
    if (rre) throw new Error(rre.message);

    // Aggregate per player
    type Agg = { player_id: string; points: number; wins: number; rounds_played: number; net: number; bestNet: number; comeback: boolean; bubbleCount: number };
    const perPlayer = new Map<string, Agg>();
    const roundById = new Map<string, any>((rounds ?? []).map((r: any) => [r.id, r]));

    for (const r of (results ?? []) as any[]) {
      let a = perPlayer.get(r.player_id);
      if (!a) {
        a = { player_id: r.player_id, points: 0, wins: 0, rounds_played: 0, net: 0, bestNet: -Infinity, comeback: false, bubbleCount: 0 };
        perPlayer.set(r.player_id, a);
      }
      a.points += r.points_awarded;
      a.rounds_played += 1;
      a.net += Number(r.net_amount);
      if (r.finish_position === 1) a.wins += 1;
      if (Number(r.net_amount) > a.bestNet) a.bestNet = Number(r.net_amount);
      if (r.finish_position === 1 && r.rebuys >= 2) a.comeback = true;
      const rd = roundById.get(r.round_id);
      const paidCount = Array.isArray(rd?.payout_structure) ? rd.payout_structure.length : 1;
      if (r.finish_position === paidCount + 1) a.bubbleCount += 1;
    }

    const standings = Array.from(perPlayer.values()).sort((a, b) => b.points - a.points || b.wins - a.wins || b.net - a.net);
    const ranked = standings.map((s, i) => ({ ...s, rank: i + 1 }));

    // Snapshot
    const standingsRows = ranked.map((s) => ({
      season_id: active.id,
      player_id: s.player_id,
      rank: s.rank,
      points: s.points,
      wins: s.wins,
      rounds_played: s.rounds_played,
      net: s.net,
    }));
    if (standingsRows.length > 0) {
      const { error: se } = await (sb as any).from("season_standings").insert(standingsRows);
      if (se) throw new Error(se.message);
    }

    // Load badges (by auto_rule)
    const { data: badges } = await (sb as any).from("badges").select("*");
    const byRule = new Map<string, any>();
    for (const b of (badges ?? []) as any[]) if (b.auto_rule) byRule.set(b.auto_rule, b);

    const awards: any[] = [];
    const award = (rule: string, player_id: string, note: string, lifetime = false) => {
      const b = byRule.get(rule);
      if (!b) return;
      awards.push({ player_id, badge_id: b.id, season_id: lifetime ? null : active.id, note });
    };

    if (ranked[0]) award("season_rank_1", ranked[0].player_id, `Champion of ${active.name}`);
    if (ranked[1]) award("season_rank_2", ranked[1].player_id, `Runner-up in ${active.name}`);
    if (ranked[2]) award("season_rank_3", ranked[2].player_id, `Third place in ${active.name}`);

    // Biggest single-round win
    const big = ranked.reduce((best, s) => (s.bestNet > (best?.bestNet ?? -Infinity) ? s : best), undefined as Agg | undefined);
    if (big && big.bestNet > 0) award("biggest_win", big.player_id, `Biggest win in ${active.name}: +${Math.round(big.bestNet)}`);

    // Perfect attendance
    for (const s of ranked) {
      if (s.rounds_played === roundIds.length && roundIds.length >= 2) {
        award("perfect_attendance", s.player_id, `Played all ${roundIds.length} rounds in ${active.name}`);
      }
    }

    // Comeback Kid
    for (const s of ranked) if (s.comeback) award("comeback_win", s.player_id, `Won after 2+ rebuys in ${active.name}`);

    // Most bubble
    const maxBubble = Math.max(0, ...ranked.map((s) => s.bubbleCount));
    if (maxBubble > 0) for (const s of ranked) if (s.bubbleCount === maxBubble) award("most_bubble", s.player_id, `${maxBubble} bubble finishes in ${active.name}`);

    // First Blood (lifetime — first-ever win across all data)
    const firstBlood = byRule.get("first_win");
    if (firstBlood) {
      const { data: existingFB } = await (sb as any)
        .from("player_badges").select("player_id").eq("badge_id", firstBlood.id).is("season_id", null);
      const have = new Set<string>((existingFB ?? []).map((x: any) => x.player_id));
      for (const s of ranked) if (s.wins > 0 && !have.has(s.player_id)) {
        awards.push({ player_id: s.player_id, badge_id: firstBlood.id, season_id: null, note: "First-ever tournament win" });
        have.add(s.player_id);
      }
    }

    if (awards.length > 0) {
      const { error: aee } = await (sb as any).from("player_badges").upsert(awards, { onConflict: "player_id,badge_id,season_id" });
      if (aee) throw new Error(aee.message);
    }

    // Close + open new
    const closed = new Date().toISOString();
    await (sb as any).from("seasons").update({ ended_at: closed }).eq("id", active.id);
    const newName = data.newSeasonName ?? defaultSeasonName();
    const { data: ns, error: nse } = await (sb as any).from("seasons").insert({ name: newName }).select("id").single();
    if (nse) throw new Error(nse.message);

    return { ok: true, closed_season_id: active.id, new_season_id: ns.id, awarded: awards.length };
  });

function defaultSeasonName(): string {
  const d = new Date();
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}
