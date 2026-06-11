
ALTER TABLE public.round_results
  ADD COLUMN IF NOT EXISTS bust_time_seconds integer,
  ADD COLUMN IF NOT EXISTS rebuy_times jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS avatar_url text;
