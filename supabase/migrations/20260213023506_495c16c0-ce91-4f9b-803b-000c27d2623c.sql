
-- campaigns
ALTER TABLE public.campaigns ALTER COLUMN api_config_id DROP NOT NULL;
ALTER TABLE public.campaigns DROP CONSTRAINT campaigns_api_config_id_fkey;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_api_config_id_fkey
  FOREIGN KEY (api_config_id) REFERENCES public.api_configs(id) ON DELETE SET NULL;

-- scheduled_messages  
ALTER TABLE public.scheduled_messages ALTER COLUMN api_config_id DROP NOT NULL;
ALTER TABLE public.scheduled_messages DROP CONSTRAINT scheduled_messages_api_config_id_fkey;
ALTER TABLE public.scheduled_messages ADD CONSTRAINT scheduled_messages_api_config_id_fkey
  FOREIGN KEY (api_config_id) REFERENCES public.api_configs(id) ON DELETE SET NULL;

-- message_logs
ALTER TABLE public.message_logs ALTER COLUMN api_config_id DROP NOT NULL;
ALTER TABLE public.message_logs DROP CONSTRAINT message_logs_api_config_id_fkey;
ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_api_config_id_fkey
  FOREIGN KEY (api_config_id) REFERENCES public.api_configs(id) ON DELETE SET NULL;
