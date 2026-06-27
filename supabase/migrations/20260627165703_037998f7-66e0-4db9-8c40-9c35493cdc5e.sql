
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasons TO anon, authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons readable" ON public.seasons FOR SELECT USING (true);

ALTER TABLE public.rounds ADD COLUMN season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL;
CREATE INDEX rounds_season_id_idx ON public.rounds(season_id);

CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT '🏆',
  color text NOT NULL DEFAULT '#f59e0b',
  description text,
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','auto')),
  auto_rule text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges readable" ON public.badges FOR SELECT USING (true);

CREATE TABLE public.player_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  note text,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, badge_id, season_id)
);
GRANT SELECT ON public.player_badges TO anon, authenticated;
GRANT ALL ON public.player_badges TO service_role;
ALTER TABLE public.player_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_badges readable" ON public.player_badges FOR SELECT USING (true);
CREATE INDEX player_badges_player_idx ON public.player_badges(player_id);
CREATE INDEX player_badges_season_idx ON public.player_badges(season_id);

CREATE TABLE public.season_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rank int NOT NULL,
  points int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  rounds_played int NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, player_id)
);
GRANT SELECT ON public.season_standings TO anon, authenticated;
GRANT ALL ON public.season_standings TO service_role;
ALTER TABLE public.season_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_standings readable" ON public.season_standings FOR SELECT USING (true);

INSERT INTO public.seasons (name) VALUES ('Season 1');
UPDATE public.rounds SET season_id = (SELECT id FROM public.seasons ORDER BY started_at ASC LIMIT 1) WHERE season_id IS NULL;

INSERT INTO public.badges (name, icon, color, description, kind, auto_rule, sort_order) VALUES
  ('Season Champion', '🥇', '#fbbf24', 'Finished #1 in a season', 'auto', 'season_rank_1', 1),
  ('Runner-up',       '🥈', '#9ca3af', 'Finished #2 in a season', 'auto', 'season_rank_2', 2),
  ('Bronze',          '🥉', '#b45309', 'Finished #3 in a season', 'auto', 'season_rank_3', 3),
  ('First Blood',     '🩸', '#ef4444', 'First-ever tournament win', 'auto', 'first_win', 4),
  ('Iron Man',        '🛡️', '#64748b', 'Played every round of a season', 'auto', 'perfect_attendance', 5),
  ('High Roller',     '💎', '#06b6d4', 'Biggest single-round win of a season', 'auto', 'biggest_win', 6),
  ('Comeback Kid',    '🔥', '#f97316', 'Won a round after 2+ rebuys', 'auto', 'comeback_win', 7),
  ('Bubble Boy',      '🫧', '#3b82f6', 'Most "just out of the money" finishes in a season', 'auto', 'most_bubble', 8),
  ('Shark',           '🦈', '#0ea5e9', 'Granted by admin', 'manual', NULL, 9),
  ('Fish',            '🐟', '#f43f5e', 'Granted by admin (for fun)', 'manual', NULL, 10);
