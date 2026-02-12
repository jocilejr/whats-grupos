#!/bin/bash
# Configura o pg_cron job para disparar send-scheduled-messages a cada minuto
# Uso: ./setup-cron.sh <supabase_dir> <api_domain> <anon_key> <db_password>

SUPABASE_DIR="$1"
API_DOMAIN="$2"
ANON_KEY="$3"
DB_PASSWORD="$4"

if [ -z "$SUPABASE_DIR" ] || [ -z "$API_DOMAIN" ] || [ -z "$ANON_KEY" ]; then
  echo "Uso: $0 <supabase_dir> <api_domain> <anon_key> <db_password>" >&2
  exit 1
fi

cd "${SUPABASE_DIR}/docker"

echo "[INFO] Configurando cron job para mensagens agendadas..."

docker compose exec -T db psql -U postgres -d postgres <<SQL
-- Remove cron job anterior se existir
SELECT cron.unschedule('send-scheduled-messages') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-scheduled-messages'
);

-- Cria novo cron job - dispara a cada minuto
SELECT cron.schedule(
  'send-scheduled-messages',
  '* * * * *',
  \$\$
  SELECT net.http_post(
    url := 'https://${API_DOMAIN}/functions/v1/send-scheduled-messages',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ${ANON_KEY}"}'::jsonb,
    body := concat('{"time":"', now(), '"}')::jsonb
  ) AS request_id;
  \$\$
);
SQL

if [ $? -ne 0 ]; then
  echo "[ERRO] Falha ao configurar cron job." >&2
  exit 1
fi

echo "[OK] Cron job configurado: send-scheduled-messages (a cada minuto)."
