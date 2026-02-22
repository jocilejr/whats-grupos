#!/bin/bash
# Cria usuario administrador via Supabase Auth API (Kong)
# Uso: ./create-admin.sh <service_role_key> <anon_key> <email> <password> <db_password> <db_port>

SERVICE_ROLE_KEY="$1"
ANON_KEY="$2"
ADMIN_EMAIL="$3"
ADMIN_PASSWORD="$4"
DB_PASSWORD="${5:-}"
DB_PORT="${6:-5432}"

KONG_URL="http://localhost:8000"
SUPABASE_DIR="/opt/supabase-docker/docker"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC} $1"; }

die() { log_error "$1"; exit 1; }

# ---- Aguardar Kong/Auth ficarem prontos ----
log_info "Aguardando API ficar pronta..."
READY=false
for i in $(seq 1 30); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${KONG_URL}/auth/v1/health" \
    -H "apikey: ${ANON_KEY}" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    READY=true
    break
  fi
  sleep 2
done

if [ "$READY" = false ]; then
  die "API Auth nao ficou pronta em 60s. Verifique: docker compose logs auth"
fi
log_success "API Auth pronta."

# ---- Criar usuario via GoTrue Admin API ----
log_info "Criando usuario admin: ${ADMIN_EMAIL}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${KONG_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"${ADMIN_PASSWORD}\",
    \"email_confirm\": true
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

log_info "[DEBUG] HTTP ${HTTP_CODE} - Body: ${BODY}"

# Extrair user_id da resposta
USER_ID=$(echo "$BODY" | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1 || true)

if [ -z "$USER_ID" ]; then
  # Verificar se usuario ja existe
  if echo "$BODY" | grep -qi "already.*registered\|already.*exists\|duplicate"; then
    log_info "Usuario ja existe. Buscando ID..."

    LIST_RESPONSE=$(curl -s "${KONG_URL}/auth/v1/admin/users" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "apikey: ${ANON_KEY}" || true)

    USER_ID=$(echo "$LIST_RESPONSE" | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1 || true)
  fi
fi

# Fallback: criar usuario direto via psql
if [ -z "$USER_ID" ]; then
  log_info "API nao retornou user_id. Tentando criar via SQL direto..."

  USER_ID=$(cd "${SUPABASE_DIR}" && docker compose exec -T db \
    psql -U postgres -d postgres -t -A -c "
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password,
        email_confirmed_at, aud, role, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
        '${ADMIN_EMAIL}',
        crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
        now(), 'authenticated', 'authenticated',
        '{\"display_name\": \"Administrador\"}'::jsonb,
        now(), now()
      )
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id;
    " 2>&1 | tr -d '[:space:]')

  if [ -z "$USER_ID" ]; then
    # Ultima tentativa: buscar ID de usuario existente via psql
    USER_ID=$(cd "${SUPABASE_DIR}" && docker compose exec -T db \
      psql -U postgres -d postgres -t -A \
      -c "SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}' LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
  fi

  if [ -z "$USER_ID" ]; then
    die "Falha ao criar usuario. HTTP ${HTTP_CODE} - Resposta API: ${BODY}"
  fi

  log_success "Usuario criado/encontrado via SQL: ${USER_ID}"
fi

log_success "User ID: ${USER_ID}"

# ---- Inserir role admin e plano via psql ----
log_info "Configurando role admin e plano..."

cd "${SUPABASE_DIR}"

docker compose exec -T db psql -U postgres -d postgres <<SQL
-- Inserir role admin (ignorar se ja existe)
INSERT INTO public.user_roles (user_id, role)
VALUES ('${USER_ID}', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Inserir plano ilimitado (ignorar se ja existe)
INSERT INTO public.user_plans (user_id, max_instances, max_campaigns, max_messages_per_hour, max_ai_requests_per_month, is_active)
VALUES ('${USER_ID}', 999, 999, 9999, 9999, true)
ON CONFLICT DO NOTHING;

-- Criar perfil se nao existir
INSERT INTO public.profiles (user_id, email, display_name)
VALUES ('${USER_ID}', '${ADMIN_EMAIL}', 'Administrador')
ON CONFLICT DO NOTHING;
SQL

if [ $? -ne 0 ]; then
  die "Falha ao configurar role/plano do admin."
fi

log_success "Admin configurado com sucesso!"
log_success "Email: ${ADMIN_EMAIL}"
log_success "Role: admin"
log_success "Plano: ilimitado"
