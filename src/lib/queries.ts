import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Player = {
  id: string;
  name: string;
  nickname: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
};

export type Round = {
  id: string;
  name: string;
  played_at: string;
  buy_in: number;
  rebuy_amount: number;
  payout_structure: number[];
  level_minutes: number;
  blind_multiplier: number;
  starting_sb: number;
  starting_bb: number;
  total_players: number;
  total_rebuys: number;
  total_pot: number;
  duration_seconds: number;
  notes: string | null;
  season_id: string | null;
  created_at: string;
};

export type RoundResult = {
  id: string;
  round_id: string;
  player_id: string;
  finish_position: number;
  rebuys: number;
  bust_sb: number | null;
  bust_bb: number | null;
  bust_level: number | null;
  bust_time_seconds: number | null;
  rebuy_times: number[];
  payout: number;
  net_amount: number;
  points_awarded: number;
};

export type Settings = {
  id: number;
  point_system: number[];
  default_buy_in: number;
  default_rebuy: number;
  default_level_minutes: number;
  default_starting_sb: number;
  default_starting_bb: number;
  default_blind_multiplier: number;
  currency: string;
};

export type Season = {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type Badge = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  kind: "manual" | "auto";
  auto_rule: string | null;
  sort_order: number;
};

export type PlayerBadge = {
  id: string;
  player_id: string;
  badge_id: string;
  season_id: string | null;
  note: string | null;
  awarded_at: string;
};

export type SeasonStanding = {
  id: string;
  season_id: string;
  player_id: string;
  rank: number;
  points: number;
  wins: number;
  rounds_played: number;
  net: number;
};

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("name");
      if (error) throw error;
      return data as Player[];
    },
  });
}

export function useRounds() {
  return useQuery({
    queryKey: ["rounds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .order("played_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        payout_structure: r.payout_structure as unknown as number[],
      })) as Round[];
    },
  });
}

export function useResults() {
  return useQuery({
    queryKey: ["results"],
    queryFn: async () => {
      const { data, error } = await supabase.from("round_results").select("*");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        rebuy_times: (r.rebuy_times as unknown as number[]) ?? [],
      })) as RoundResult[];
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return {
        ...data,
        point_system: data.point_system as unknown as number[],
      } as Settings;
    },
  });
}

export function useRound(id: string) {
  return useQuery({
    queryKey: ["round", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("rounds").select("*").eq("id", id).single();
      if (error) throw error;
      return {
        ...data,
        payout_structure: (data as any).payout_structure as unknown as number[],
      } as Round;
    },
  });
}

export function useRoundResults(roundId: string) {
  return useQuery({
    queryKey: ["round-results", roundId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("round_results")
        .select("*")
        .eq("round_id", roundId)
        .order("finish_position");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        rebuy_times: (r.rebuy_times as unknown as number[]) ?? [],
      })) as RoundResult[];
    },
  });
}

export function useSeasons() {
  return useQuery({
    queryKey: ["seasons"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seasons")
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Season[];
    },
  });
}

export function useBadges() {
  return useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("badges")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Badge[];
    },
  });
}

export function usePlayerBadges() {
  return useQuery({
    queryKey: ["player_badges"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("player_badges").select("*");
      if (error) throw error;
      return (data ?? []) as PlayerBadge[];
    },
  });
}

export function useSeasonStandings(seasonId?: string) {
  return useQuery({
    queryKey: ["season_standings", seasonId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any).from("season_standings").select("*").order("rank");
      if (seasonId) q = q.eq("season_id", seasonId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SeasonStanding[];
    },
  });
}
