ALTER TABLE public.global_config
ADD COLUMN IF NOT EXISTS baileys_api_key text NOT NULL DEFAULT '';