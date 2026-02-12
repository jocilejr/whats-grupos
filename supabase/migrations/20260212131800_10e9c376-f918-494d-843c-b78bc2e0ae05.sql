-- Track which group index was last processed (for batch resume)
ALTER TABLE public.scheduled_messages 
ADD COLUMN sent_group_index integer NOT NULL DEFAULT 0;

-- Update claim function to also pick up mid-batch messages
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
      AND (sm.processing_started_at IS NULL OR sm.processing_started_at < now() - interval '5 minutes')
      AND (sm.campaign_id IS NULL OR c.is_active = true)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;