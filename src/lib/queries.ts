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

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("name");
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
      return (data ?? []).map((r) => ({
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
        payout_structure: data.payout_structure as unknown as number[],
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
