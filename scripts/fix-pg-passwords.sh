#!/bin/bash
# Corrige senhas dos usuarios internos do PostgreSQL no Supabase Self-Hosted
# Uso: ./fix-pg-passwords.sh <db_password>

set -euo pipefail

DB_PASSWORD="$1"
SUPABASE_DIR="/opt/supabase-docker/docker"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC} $1"; }

die() { log_error "$1"; exit 1; }

cd "${SUPABASE_DIR}"

# ---- 1. Backup e editar pg_hba.conf para trust ----
log_info "Configurando acesso trust temporario..."

docker compose exec -T db bash -c "\
  cp /var/lib/postgresql/data/pg_hba.conf /var/lib/postgresql/data/pg_hba.conf.bak && \
  (echo 'local all all trust'; echo 'host all all 0.0.0.0/0 trust'; echo 'host all all ::0/0 trust') > /tmp/hba_trust.conf && \
  cat /var/lib/postgresql/data/pg_hba.conf >> /tmp/hba_trust.conf && \
  cp /tmp/hba_trust.conf /var/lib/postgresql/data/pg_hba.conf" \
  || die "Falha ao editar pg_hba.conf"

# ---- 2. Reiniciar DB para aplicar trust ----
log_info "Reiniciando banco de dados para aplicar trust..."
docker compose restart db
sleep 15

# Aguardar DB ficar pronto
READY=false
for i in $(seq 1 20); do
  if docker compose exec -T db pg_isready -U postgres &>/dev/null; then
    READY=true
    break
  fi
  sleep 3
done

if [ "$READY" = false ]; then
  die "Banco nao ficou pronto apos restart com trust."
fi

log_success "Banco pronto com trust habilitado."

# ---- 3. Alterar senhas de todos os usuarios internos ----
log_info "Sincronizando senhas dos usuarios internos..."

USERS="supabase_admin supabase_auth_admin authenticator supabase_storage_admin supabase_functions_admin supabase_read_only_user supabase_replication_admin postgres"

for USER in $USERS; do
  RESULT=$(docker compose exec -T db psql -U supabase_admin -d postgres \
    -c "ALTER USER ${USER} WITH PASSWORD '${DB_PASSWORD}';" 2>&1 || true)
  if echo "$RESULT" | grep -qi "error\|does not exist"; then
    log_warn "Usuario ${USER}: ignorado (pode nao existir)"
  else
    log_success "Senha atualizada: ${USER}"
  fi
done

# ---- 4. Restaurar pg_hba.conf original e reiniciar ----
log_info "Restaurando pg_hba.conf original..."

docker compose exec -T db bash -c "\
  cp /var/lib/postgresql/data/pg_hba.conf.bak /var/lib/postgresql/data/pg_hba.conf" \
  || log_warn "Falha ao restaurar pg_hba.conf.bak"

log_info "Reiniciando banco com configuracao original..."
docker compose restart db
sleep 15

# Aguardar DB ficar pronto
READY=false
for i in $(seq 1 20); do
  if docker compose exec -T db pg_isready -U postgres &>/dev/null; then
    READY=true
    break
  fi
  sleep 3
done

if [ "$READY" = false ]; then
  die "Banco nao ficou pronto apos restaurar pg_hba.conf."
fi

# ---- 5. Reiniciar todos os servicos para pegar as novas senhas ----
log_info "Reiniciando todos os servicos do Supabase..."
docker compose restart
sleep 20

log_success "Senhas do PostgreSQL sincronizadas com sucesso!"
