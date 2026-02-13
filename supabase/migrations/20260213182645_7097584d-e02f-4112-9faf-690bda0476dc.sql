
CREATE INDEX IF NOT EXISTS idx_message_logs_user_created ON public.message_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_queue_status_priority ON public.message_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_next_run ON public.scheduled_messages(is_active, next_run_at) WHERE is_active = true;
