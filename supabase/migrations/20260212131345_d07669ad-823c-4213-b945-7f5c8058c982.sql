-- Add processing lock column
ALTER TABLE public.scheduled_messages 
ADD COLUMN processing_started_at timestamptz DEFAULT NULL;

-- Create atomic function to claim due messages (prevents race condition)
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
      -- Skip if already being processed (lock window of 5 minutes)
      AND (sm.processing_started_at IS NULL OR sm.processing_started_at < now() - interval '5 minutes')
      -- Skip if campaign is inactive
      AND (sm.campaign_id IS NULL OR c.is_active = true)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;