
-- Create message_queue table
CREATE TABLE public.message_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scheduled_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  group_id TEXT NOT NULL,
  group_name TEXT,
  instance_name TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  api_config_id UUID REFERENCES public.api_configs(id) ON DELETE SET NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  execution_batch UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own queue items"
ON public.message_queue FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for queue processing (consumer picks pending items)
CREATE INDEX idx_message_queue_status_priority ON public.message_queue (status, priority, created_at);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_queue;

-- Function to atomically claim next queue item
CREATE OR REPLACE FUNCTION public.claim_next_queue_item()
RETURNS SETOF public.message_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE message_queue
  SET status = 'sending', started_at = now()
  WHERE id = (
    SELECT mq.id
    FROM message_queue mq
    WHERE mq.status = 'pending'
    ORDER BY mq.priority ASC, mq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
