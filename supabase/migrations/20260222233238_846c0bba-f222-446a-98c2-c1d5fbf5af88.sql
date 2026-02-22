ALTER TABLE global_config 
  ALTER COLUMN baileys_api_url SET DEFAULT 'http://baileys-server:3100';

UPDATE global_config 
  SET baileys_api_url = 'http://baileys-server:3100';