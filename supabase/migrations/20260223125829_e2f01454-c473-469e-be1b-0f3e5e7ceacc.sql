
CREATE TABLE public.group_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  group_id text NOT NULL,
  group_name text NOT NULL,
  member_count integer NOT NULL DEFAULT 0,
  joined_today integer NOT NULL DEFAULT 0,
  left_today integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id, snapshot_date)
);

ALTER TABLE public.group_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own group_stats"
  ON public.group_stats
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_group_stats_user_date ON public.group_stats (user_id, snapshot_date);
CREATE INDEX idx_group_stats_group ON public.group_stats (group_id, snapshot_date);
