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
    if (player.id) {
      const { error } = await sb.from("players").update({
        name: player.name,
        nickname: player.nickname ?? null,
        avatar_color: player.avatar_color ?? "#6366f1",
        active: player.active ?? true,
      }).eq("id", player.id);
      if (error) throw new Error(error.message);
      return { id: player.id };
    } else {
      const { data: row, error } = await sb.from("players").insert({
        name: player.name,
        nickname: player.nickname ?? null,
        avatar_color: player.avatar_color ?? "#6366f1",
        active: player.active ?? true,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
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
    const { error } = await (sb.rpc as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
      "set_admin_password",
      { _new_password: data.newPassword },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Round save (no password — anyone can save a round result)
const resultSchema = z.object({
  player_id: z.string().uuid(),
  finish_position: z.number().int().min(1).max(100),
  rebuys: z.number().int().min(0).max(50).default(0),
  bust_sb: z.number().int().nullable().optional(),
  bust_bb: z.number().int().nullable().optional(),
  bust_level: z.number().int().nullable().optional(),
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

    // Fetch point system
    const { data: settings } = await sb.from("settings").select("point_system").eq("id", 1).single();
    const pointSystem: number[] = (settings?.point_system as number[]) ?? [
      100, 75, 60, 50, 40, 30, 25, 20, 15, 10,
    ];

    const totalRebuys = round.results.reduce((s, r) => s + (r.rebuys ?? 0), 0);
    const totalPlayers = round.results.length;
    const totalPot =
      totalPlayers * round.buy_in + totalRebuys * round.rebuy_amount;

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
      })
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
