
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to reset stuck "sending" items back to "pending" after 5 minutes
CREATE OR REPLACE FUNCTION public.reset_stuck_queue_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE message_queue
  SET status = 'pending', started_at = NULL
  WHERE status = 'sending'
    AND started_at < now() - interval '5 minutes';
END;
$$;

-- Function to clean old queue items (sent/error older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_queue_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM message_queue
  WHERE status IN ('sent', 'error')
    AND completed_at < now() - interval '7 days';
END;
$$;

-- Schedule: reset stuck items every 2 minutes
SELECT cron.schedule(
  'reset-stuck-queue-items',
  '*/2 * * * *',
  $$SELECT public.reset_stuck_queue_items()$$
);

-- Schedule: cleanup old items daily at 3am
SELECT cron.schedule(
  'cleanup-old-queue-items',
  '0 3 * * *',
  $$SELECT public.cleanup_old_queue_items()$$
);
