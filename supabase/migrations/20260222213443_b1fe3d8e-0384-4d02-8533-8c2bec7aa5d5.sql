ALTER TABLE global_config 
  ADD COLUMN IF NOT EXISTS whatsapp_provider text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS baileys_api_url text NOT NULL DEFAULT 'http://localhost:3100';