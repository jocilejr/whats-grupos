
CREATE TABLE public.group_participant_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name text NOT NULL,
  group_id text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  participant_jid text NOT NULL,
  action text NOT NULL,
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gpe_instance_date ON public.group_participant_events (instance_name, created_at DESC);
CREATE INDEX idx_gpe_group_date ON public.group_participant_events (group_id, created_at DESC);

ALTER TABLE public.group_participant_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own instance events" ON public.group_participant_events
  FOR SELECT USING (
    instance_name IN (
      SELECT ac.instance_name FROM api_configs ac WHERE ac.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert events" ON public.group_participant_events
  FOR INSERT WITH CHECK (true);
