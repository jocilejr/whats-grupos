
-- Remove existing RESTRICTIVE policies
DROP POLICY IF EXISTS "Users read own instance events" ON public.group_participant_events;
DROP POLICY IF EXISTS "Service role can insert events" ON public.group_participant_events;

-- Recreate as PERMISSIVE
CREATE POLICY "Users read own instance events" ON public.group_participant_events
  FOR SELECT USING (
    instance_name IN (
      SELECT ac.instance_name FROM api_configs ac WHERE ac.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert events" ON public.group_participant_events
  FOR INSERT WITH CHECK (true);
