ALTER TABLE global_config ADD COLUMN IF NOT EXISTS vps_api_url text NOT NULL DEFAULT '';

-- Set initial value
UPDATE global_config SET vps_api_url = 'https://api.app.simplificandogrupos.com' WHERE vps_api_url = '';