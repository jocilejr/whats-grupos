
CREATE TABLE public.user_selected_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  group_id text NOT NULL,
  group_name text,
  instance_name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, group_id)
);

ALTER TABLE public.user_selected_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own selected groups"
  ON public.user_selected_groups
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
