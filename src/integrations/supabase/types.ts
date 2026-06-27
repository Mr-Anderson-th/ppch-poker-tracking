export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          auto_rule: string | null
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          kind: string
          name: string
          sort_order: number
        }
        Insert: {
          auto_rule?: string | null
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          kind?: string
          name: string
          sort_order?: number
        }
        Update: {
          auto_rule?: string | null
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      clock_sessions: {
        Row: {
          ended_at: string | null
          id: string
          round_id: string | null
          started_at: string
          user_agent: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          round_id?: string | null
          started_at?: string
          user_agent?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          round_id?: string | null
          started_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clock_sessions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      player_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          note: string | null
          player_id: string
          season_id: string | null
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          note?: string | null
          player_id: string
          season_id?: string | null
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          note?: string | null
          player_id?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_badges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_badges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          avatar_color: string | null
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          nickname: string | null
        }
        Insert: {
          active?: boolean
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          nickname?: string | null
        }
        Update: {
          active?: boolean
          avatar_color?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          nickname?: string | null
        }
        Relationships: []
      }
      round_results: {
        Row: {
          bust_bb: number | null
          bust_level: number | null
          bust_sb: number | null
          bust_time_seconds: number | null
          finish_position: number
          id: string
          net_amount: number
          payout: number
          player_id: string
          points_awarded: number
          rebuy_times: Json
          rebuys: number
          round_id: string
        }
        Insert: {
          bust_bb?: number | null
          bust_level?: number | null
          bust_sb?: number | null
          bust_time_seconds?: number | null
          finish_position: number
          id?: string
          net_amount?: number
          payout?: number
          player_id: string
          points_awarded?: number
          rebuy_times?: Json
          rebuys?: number
          round_id: string
        }
        Update: {
          bust_bb?: number | null
          bust_level?: number | null
          bust_sb?: number | null
          bust_time_seconds?: number | null
          finish_position?: number
          id?: string
          net_amount?: number
          payout?: number
          player_id?: string
          points_awarded?: number
          rebuy_times?: Json
          rebuys?: number
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          blind_multiplier: number
          buy_in: number
          created_at: string
          duration_seconds: number
          id: string
          level_minutes: number
          name: string
          notes: string | null
          payout_structure: Json
          played_at: string
          rebuy_amount: number
          season_id: string | null
          starting_bb: number
          starting_sb: number
          total_players: number
          total_pot: number
          total_rebuys: number
        }
        Insert: {
          blind_multiplier?: number
          buy_in?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          level_minutes?: number
          name: string
          notes?: string | null
          payout_structure?: Json
          played_at?: string
          rebuy_amount?: number
          season_id?: string | null
          starting_bb?: number
          starting_sb?: number
          total_players?: number
          total_pot?: number
          total_rebuys?: number
        }
        Update: {
          blind_multiplier?: number
          buy_in?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          level_minutes?: number
          name?: string
          notes?: string | null
          payout_structure?: Json
          played_at?: string
          rebuy_amount?: number
          season_id?: string | null
          starting_bb?: number
          starting_sb?: number
          total_players?: number
          total_pot?: number
          total_rebuys?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_standings: {
        Row: {
          created_at: string
          id: string
          net: number
          player_id: string
          points: number
          rank: number
          rounds_played: number
          season_id: string
          wins: number
        }
        Insert: {
          created_at?: string
          id?: string
          net?: number
          player_id: string
          points?: number
          rank: number
          rounds_played?: number
          season_id: string
          wins?: number
        }
        Update: {
          created_at?: string
          id?: string
          net?: number
          player_id?: string
          points?: number
          rank?: number
          rounds_played?: number
          season_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_standings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          name: string
          started_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          name: string
          started_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          name?: string
          started_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          admin_password_hash: string
          currency: string
          default_blind_multiplier: number
          default_buy_in: number
          default_level_minutes: number
          default_rebuy: number
          default_starting_bb: number
          default_starting_sb: number
          id: number
          point_system: Json
        }
        Insert: {
          admin_password_hash: string
          currency?: string
          default_blind_multiplier?: number
          default_buy_in?: number
          default_level_minutes?: number
          default_rebuy?: number
          default_starting_bb?: number
          default_starting_sb?: number
          id?: number
          point_system?: Json
        }
        Update: {
          admin_password_hash?: string
          currency?: string
          default_blind_multiplier?: number
          default_buy_in?: number
          default_level_minutes?: number
          default_rebuy?: number
          default_starting_bb?: number
          default_starting_sb?: number
          id?: number
          point_system?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_admin_password: { Args: { _new_password: string }; Returns: boolean }
      verify_admin_password: { Args: { _password: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
