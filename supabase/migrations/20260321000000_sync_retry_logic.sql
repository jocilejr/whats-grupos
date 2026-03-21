
-- Add sync_retry_count and last_sync_error to campaign_smart_links to track failures
ALTER TABLE public.campaign_smart_links 
ADD COLUMN IF NOT EXISTS sync_retry_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_error text,
ADD COLUMN IF NOT EXISTS next_sync_retry_at timestamptz;

-- Create a function to be called by cron that identifies links needing sync retry
CREATE OR REPLACE FUNCTION public.check_sync_retries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function will be called by pg_cron to trigger the Edge Function
  -- We use pg_net to call the Edge Function asynchronously
  PERFORM net.http_post(
    url := (SELECT value FROM private.settings WHERE key = 'supabase_url') || '/functions/v1/sync-invite-links',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM private.settings WHERE key = 'service_role_key')
    ),
    body := jsonb_build_object('retry_mode', true)
  );
END;
$$;

-- Schedule: check for sync retries every 15 minutes
SELECT cron.schedule(
  'check-sync-retries',
  '*/15 * * * *',
  $$SELECT public.check_sync_retries()$$
);

-- Note: The actual cron schedule should be managed via Supabase Dashboard or a migration 
-- that has access to the service_role_key if needed. 
-- For now, we'll implement the logic in the Edge Function to handle the "retry_mode".
