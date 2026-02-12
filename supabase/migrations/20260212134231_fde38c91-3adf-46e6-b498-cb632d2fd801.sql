
CREATE OR REPLACE FUNCTION public.claim_due_messages()
RETURNS SETOF scheduled_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE scheduled_messages
  SET processing_started_at = now()
  WHERE id IN (
    SELECT sm.id
    FROM scheduled_messages sm
    WHERE sm.is_active = true
      AND sm.next_run_at <= now()
      AND (sm.processing_started_at IS NULL OR sm.processing_started_at < now() - interval '5 minutes')
      -- Campaign check: allow if no campaign, or if campaign is active
      AND (sm.campaign_id IS NULL OR EXISTS (
        SELECT 1 FROM campaigns c WHERE c.id = sm.campaign_id AND c.is_active = true
      ))
      AND (sm.last_completed_at IS NULL OR sm.last_completed_at < sm.next_run_at)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
