#!/bin/bash
# Cria usuario administrador via Supabase Auth API (Kong)
# Uso: ./create-admin.sh <service_role_key> <anon_key> <email> <password> <db_password> <db_port>

set -euo pipefail

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

RESPONSE=$(curl -s -X POST "${KONG_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${ADMIN_EMAIL}\",
    \"password\": \"${ADMIN_PASSWORD}\",
    \"email_confirm\": true
  }")

# Extrair user_id da resposta
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  # Verificar se usuario ja existe
  if echo "$RESPONSE" | grep -qi "already.*registered\|already.*exists\|duplicate"; then
    log_info "Usuario ja existe. Buscando ID..."
    
    LIST_RESPONSE=$(curl -s "${KONG_URL}/auth/v1/admin/users" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "apikey: ${ANON_KEY}")
    
    USER_ID=$(echo "$LIST_RESPONSE" | grep -o "\"id\":\"[^\"]*\",\"aud\":\"authenticated\",\"role\":\"authenticated\",\"email\":\"${ADMIN_EMAIL}\"" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)
    
    if [ -z "$USER_ID" ]; then
      # Fallback: buscar via psql
      if [ -n "$DB_PASSWORD" ]; then
        USER_ID=$(cd "${SUPABASE_DIR}" && docker compose exec -T db \
          psql -U postgres -d postgres -t -A \
          -c "SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}' LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
      fi
    fi
    
    if [ -z "$USER_ID" ]; then
      die "Usuario existe mas nao foi possivel obter o ID. Resposta: ${RESPONSE}"
    fi
    log_success "Usuario encontrado: ${USER_ID}"
  else
    die "Falha ao criar usuario. Resposta: ${RESPONSE}"
  fi
else
  log_success "Usuario criado: ${USER_ID}"
fi

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
