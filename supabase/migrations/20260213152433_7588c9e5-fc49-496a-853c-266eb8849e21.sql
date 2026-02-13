
ALTER TABLE public.global_config ADD COLUMN queue_delay_seconds INTEGER NOT NULL DEFAULT 10;
