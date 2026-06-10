
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- settings: singleton row
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1,
  admin_password_hash TEXT NOT NULL,
  point_system JSONB NOT NULL DEFAULT '[100,75,60,50,40,30,25,20,15,10]'::jsonb,
  default_buy_in NUMERIC NOT NULL DEFAULT 500,
  default_rebuy NUMERIC NOT NULL DEFAULT 500,
  default_level_minutes INT NOT NULL DEFAULT 15,
  default_starting_sb INT NOT NULL DEFAULT 25,
  default_starting_bb INT NOT NULL DEFAULT 50,
  default_blind_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  currency TEXT NOT NULL DEFAULT '฿',
  CONSTRAINT settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.settings FOR SELECT USING (true);

INSERT INTO public.settings (id, admin_password_hash)
VALUES (1, crypt('935639', gen_salt('bf')));

-- players
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  nickname TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players readable" ON public.players FOR SELECT USING (true);

-- rounds
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  buy_in NUMERIC NOT NULL DEFAULT 0,
  rebuy_amount NUMERIC NOT NULL DEFAULT 0,
  payout_structure JSONB NOT NULL DEFAULT '[100]'::jsonb,
  level_minutes INT NOT NULL DEFAULT 15,
  blind_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  starting_sb INT NOT NULL DEFAULT 25,
  starting_bb INT NOT NULL DEFAULT 50,
  total_players INT NOT NULL DEFAULT 0,
  total_rebuys INT NOT NULL DEFAULT 0,
  total_pot NUMERIC NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rounds TO anon, authenticated;
GRANT ALL ON public.rounds TO service_role;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rounds readable" ON public.rounds FOR SELECT USING (true);

-- round_results
CREATE TABLE public.round_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  finish_position INT NOT NULL,
  rebuys INT NOT NULL DEFAULT 0,
  bust_sb INT,
  bust_bb INT,
  bust_level INT,
  payout NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  points_awarded INT NOT NULL DEFAULT 0,
  UNIQUE(round_id, player_id)
);
CREATE INDEX idx_results_player ON public.round_results(player_id);
CREATE INDEX idx_results_round ON public.round_results(round_id);
GRANT SELECT ON public.round_results TO anon, authenticated;
GRANT ALL ON public.round_results TO service_role;
ALTER TABLE public.round_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results readable" ON public.round_results FOR SELECT USING (true);

-- clock audit log (optional)
CREATE TABLE public.clock_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES public.rounds(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  user_agent TEXT
);
GRANT SELECT ON public.clock_sessions TO anon, authenticated;
GRANT ALL ON public.clock_sessions TO service_role;
ALTER TABLE public.clock_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions readable" ON public.clock_sessions FOR SELECT USING (true);

-- Helper: verify admin password
CREATE OR REPLACE FUNCTION public.verify_admin_password(_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.settings
    WHERE id = 1 AND admin_password_hash = crypt(_password, admin_password_hash)
  );
$$;
GRANT EXECUTE ON FUNCTION public.verify_admin_password(TEXT) TO service_role;
