-- Track when all groups were fully sent (deduplication safety)
ALTER TABLE public.scheduled_messages 
ADD COLUMN last_completed_at timestamptz DEFAULT NULL;

-- Update claim function with completion check
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
    LEFT JOIN campaigns c ON sm.campaign_id = c.id
    WHERE sm.is_active = true
      AND sm.next_run_at <= now()
      -- Lock: skip if being processed (5 min window)
      AND (sm.processing_started_at IS NULL OR sm.processing_started_at < now() - interval '5 minutes')
      -- Campaign check
      AND (sm.campaign_id IS NULL OR c.is_active = true)
      -- SAFETY: skip if already completed AFTER the scheduled time
      -- This prevents re-sending even if next_run_at fails to update
      AND (sm.last_completed_at IS NULL OR sm.last_completed_at < sm.next_run_at)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;