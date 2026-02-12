#!/bin/bash
set -e

# ============================================================
# Instalador Automatico - WhatsApp Grupos
# Instala Frontend + Supabase Self-Hosted em VPS Ubuntu
# ============================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC} $1"; }
log_step()    { echo -e "\n${CYAN}========================================${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}========================================${NC}\n"; }

check_error() {
  if [ $? -ne 0 ]; then
    log_error "$1"
    exit 1
  fi
}

# ============================================================
# Verificacoes iniciais
# ============================================================

if [ "$EUID" -ne 0 ]; then
  log_error "Execute como root: sudo ./install.sh"
  exit 1
fi

if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  log_error "Este instalador requer Ubuntu 22.04 ou superior."
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

log_step "Instalador Automatico - WhatsApp Grupos"
echo "Este script vai instalar:"
echo "  - Docker e Docker Compose"
echo "  - Supabase Self-Hosted (banco, auth, storage, edge functions)"
echo "  - Node.js 20 e build do frontend"
echo "  - Nginx com SSL (Certbot)"
echo ""

# ============================================================
# Perguntas interativas
# ============================================================

read -p "Digite seu dominio (ex: meusistema.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  log_error "Dominio e obrigatorio."
  exit 1
fi

# Limpar protocolo, www e barra final do dominio
DOMAIN=$(echo "$DOMAIN" | sed -e 's|^https\?://||' -e 's|/$||' -e 's|^www\.||' | xargs)

# Validar formato basico do dominio
if [[ ! "$DOMAIN" =~ \. ]]; then
  log_error "Dominio invalido: '${DOMAIN}'. Use o formato: meusistema.com"
  exit 1
fi

read -p "Digite seu email (para certificado SSL): " SSL_EMAIL
if [ -z "$SSL_EMAIL" ]; then
  log_error "Email e obrigatorio para o SSL."
  exit 1
fi

read -sp "Senha do banco de dados (Enter para gerar automaticamente): " DB_PASSWORD
echo ""
if [ -z "$DB_PASSWORD" ]; then
  DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  log_info "Senha do banco gerada automaticamente."
fi

API_DOMAIN="api.${DOMAIN}"
SUPABASE_DIR="/opt/supabase-docker"

echo ""
log_info "Dominio frontend: ${DOMAIN}"
log_info "Dominio API:      ${API_DOMAIN}"
echo ""
read -p "Confirma a instalacao? (s/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
  log_warn "Instalacao cancelada."
  exit 0
fi

# ============================================================
# 1. Instalar dependencias do sistema
# ============================================================

log_step "1/9 - Instalando dependencias do sistema"

apt-get update -qq
apt-get install -y -qq curl git apt-transport-https ca-certificates gnupg lsb-release jq

# Docker
if ! command -v docker &>/dev/null; then
  log_info "Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log_success "Docker instalado."
else
  log_success "Docker ja instalado."
fi

# Docker Compose (plugin)
if ! docker compose version &>/dev/null; then
  log_info "Instalando Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
  log_success "Docker Compose instalado."
else
  log_success "Docker Compose ja instalado."
fi

# Node.js 20
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 20 ]]; then
  log_info "Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  log_success "Node.js $(node -v) instalado."
else
  log_success "Node.js $(node -v) ja instalado."
fi

# Nginx
if ! command -v nginx &>/dev/null; then
  log_info "Instalando Nginx..."
  apt-get install -y -qq nginx
  systemctl enable nginx
  log_success "Nginx instalado."
else
  log_success "Nginx ja instalado."
fi

# Certbot
if ! command -v certbot &>/dev/null; then
  log_info "Instalando Certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx
  log_success "Certbot instalado."
else
  log_success "Certbot ja instalado."
fi

log_success "Todas as dependencias instaladas."

# ============================================================
# 2. Configurar Supabase Self-Hosted
# ============================================================

log_step "2/9 - Configurando Supabase Self-Hosted"

# Gerar chaves JWT
log_info "Gerando chaves JWT..."
JWT_SECRET=$(openssl rand -base64 32)

# Gerar ANON_KEY e SERVICE_ROLE_KEY usando Node.js
chmod +x "${PROJECT_DIR}/scripts/generate-keys.sh"
KEYS_OUTPUT=$(bash "${PROJECT_DIR}/scripts/generate-keys.sh" "$JWT_SECRET")
ANON_KEY=$(echo "$KEYS_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2-)
SERVICE_ROLE_KEY=$(echo "$KEYS_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2-)

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  log_error "Falha ao gerar chaves JWT."
  exit 1
fi

log_success "Chaves JWT geradas."

# Clonar Supabase Docker
if [ ! -d "$SUPABASE_DIR" ]; then
  log_info "Clonando Supabase Docker..."
  git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR"
else
  log_warn "Diretorio Supabase ja existe. Usando existente."
fi

cd "${SUPABASE_DIR}/docker"

# Verificar se porta 5432 esta em uso e escolher alternativa
DB_PORT=5432
if ss -tlnp | grep -q ":${DB_PORT} "; then
  log_warn "Porta ${DB_PORT} em uso. Procurando porta alternativa..."
  for PORT in 5433 5434 5435 5436 5437; do
    if ! ss -tlnp | grep -q ":${PORT} "; then
      DB_PORT=$PORT
      break
    fi
  done
  if [ "$DB_PORT" -eq 5432 ]; then
    log_error "Nenhuma porta alternativa disponivel (5432-5437)."
    exit 1
  fi
  log_info "Usando porta alternativa: ${DB_PORT}"
fi

# Copiar e configurar .env
cp -n .env.example .env 2>/dev/null || true

# Gerar DASHBOARD_PASSWORD e outros secrets
DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')
POOLER_TENANT_ID=$(openssl rand -hex 8)
LOGFLARE_API_KEY=$(openssl rand -base64 24 | tr -d '/+=')

# Configurar .env do Supabase
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASSWORD}|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
sed -i "s|ANON_KEY=.*|ANON_KEY=${ANON_KEY}|" .env
sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}|" .env
sed -i "s|DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=admin|" .env
sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}|" .env
sed -i "s|SITE_URL=.*|SITE_URL=https://${DOMAIN}|" .env
sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${API_DOMAIN}|" .env
sed -i "s|SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=https://${API_DOMAIN}|" .env
sed -i "s|LOGFLARE_API_KEY=.*|LOGFLARE_API_KEY=${LOGFLARE_API_KEY}|" .env

log_success "Arquivo .env do Supabase configurado."

# Alterar porta do PostgreSQL no docker-compose se necessario
if [ "$DB_PORT" -ne 5432 ]; then
  log_info "Alterando mapeamentos da porta 5432 no docker-compose.yml para ${DB_PORT}..."
  # Trocar TODAS as referencias de porta 5432 no host (db e pooler)
  sed -i "s|5432:5432|${DB_PORT}:5432|g" docker-compose.yml
  sed -i 's|"5432:|"'"${DB_PORT}"':|g' docker-compose.yml
  # Pooler pode ter porta interna diferente (ex: 5432:4000)
  sed -i 's|- 5432:|- '"${DB_PORT}"':|g' docker-compose.yml
fi

# Subir containers
log_info "Subindo containers do Supabase (pode demorar alguns minutos)..."
docker compose pull -q
docker compose up -d
check_error "Falha ao subir containers do Supabase."

# Aguardar o banco ficar pronto
log_info "Aguardando banco de dados ficar pronto..."
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres &>/dev/null; then
    break
  fi
  sleep 2
done
log_success "Supabase rodando."

# ============================================================
# 3. Executar migracoes do banco
# ============================================================

log_step "3/9 - Executando migracoes do banco"

chmod +x "${PROJECT_DIR}/scripts/run-migrations.sh"
bash "${PROJECT_DIR}/scripts/run-migrations.sh" "${PROJECT_DIR}/supabase/migrations" "${DB_PASSWORD}" "${DB_PORT}"
check_error "Falha ao executar migracoes."

log_success "Migracoes executadas."

# ============================================================
# 4. Habilitar extensoes pg_cron e pg_net
# ============================================================

log_step "4/9 - Habilitando extensoes do banco"

cd "${SUPABASE_DIR}/docker"

docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_cron CASCADE;" 2>/dev/null || true
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_net CASCADE;" 2>/dev/null || true

log_success "Extensoes pg_cron e pg_net habilitadas."

# ============================================================
# 5. Configurar cron job
# ============================================================

log_step "5/9 - Configurando cron job para mensagens agendadas"

chmod +x "${PROJECT_DIR}/scripts/setup-cron.sh"
bash "${PROJECT_DIR}/scripts/setup-cron.sh" "${SUPABASE_DIR}" "${API_DOMAIN}" "${ANON_KEY}" "${DB_PASSWORD}"
check_error "Falha ao configurar cron job."

log_success "Cron job configurado."

# ============================================================
# 6. Deploy das Edge Functions
# ============================================================

log_step "6/9 - Fazendo deploy das Edge Functions"

# Instalar Supabase CLI se necessario
if ! command -v supabase &>/dev/null; then
  log_info "Instalando Supabase CLI..."
  npm install -g supabase@latest
fi

# Copiar funcoes para o diretorio do Supabase Docker
FUNCTIONS_DIR="${SUPABASE_DIR}/docker/volumes/functions"
mkdir -p "$FUNCTIONS_DIR"

if [ -d "${PROJECT_DIR}/supabase/functions/evolution-api" ]; then
  cp -r "${PROJECT_DIR}/supabase/functions/evolution-api" "$FUNCTIONS_DIR/"
  log_success "Edge function 'evolution-api' copiada."
fi

if [ -d "${PROJECT_DIR}/supabase/functions/send-scheduled-messages" ]; then
  cp -r "${PROJECT_DIR}/supabase/functions/send-scheduled-messages" "$FUNCTIONS_DIR/"
  log_success "Edge function 'send-scheduled-messages' copiada."
fi

# Restart edge functions container para carregar as funcoes
cd "${SUPABASE_DIR}/docker"
docker compose restart functions 2>/dev/null || log_warn "Container 'functions' nao encontrado. Edge functions podem precisar de configuracao manual."

log_success "Edge Functions deployadas."

# ============================================================
# 7. Buildar o frontend
# ============================================================

log_step "7/9 - Buildando o frontend"

cd "$PROJECT_DIR"

# Criar .env para o frontend
cat > .env.production <<EOF
VITE_SUPABASE_URL=https://${API_DOMAIN}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=self-hosted
EOF

log_info "Instalando dependencias do frontend..."
npm install --production=false
check_error "Falha ao instalar dependencias."

log_info "Buildando aplicacao..."
npm run build
check_error "Falha ao buildar o frontend."

log_success "Frontend buildado em dist/."

# ============================================================
# 8. Configurar Nginx
# ============================================================

log_step "8/9 - Configurando Nginx"

# Remover config default
rm -f /etc/nginx/sites-enabled/default

# Frontend
sed "s|{{DOMAIN}}|${DOMAIN}|g; s|{{PROJECT_DIR}}|${PROJECT_DIR}|g" \
  "${PROJECT_DIR}/nginx/frontend.conf.template" \
  > /etc/nginx/sites-available/whats-grupos

# API proxy
sed "s|{{API_DOMAIN}}|${API_DOMAIN}|g" \
  "${PROJECT_DIR}/nginx/api.conf.template" \
  > /etc/nginx/sites-available/whats-grupos-api

ln -sf /etc/nginx/sites-available/whats-grupos /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/whats-grupos-api /etc/nginx/sites-enabled/

nginx -t
check_error "Configuracao do Nginx invalida."

systemctl restart nginx
log_success "Nginx configurado."

# ============================================================
# 9. Configurar SSL
# ============================================================

log_step "9/9 - Configurando SSL com Certbot"

certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL"
check_error "Falha ao configurar SSL."

log_success "SSL configurado."

# ============================================================
# Finalizado!
# ============================================================

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  INSTALACAO CONCLUIDA COM SUCESSO!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "  Frontend:        ${CYAN}https://${DOMAIN}${NC}"
echo -e "  API Supabase:    ${CYAN}https://${API_DOMAIN}${NC}"
echo -e "  Supabase Studio: ${CYAN}https://${API_DOMAIN}/project/default${NC}"
echo ""
echo -e "  Studio Login:"
echo -e "    Usuario: ${YELLOW}admin${NC}"
echo -e "    Senha:   ${YELLOW}${DASHBOARD_PASSWORD}${NC}"
echo ""
echo -e "  Banco de Dados:"
echo -e "    Senha:   ${YELLOW}${DB_PASSWORD}${NC}"
echo ""
echo -e "  JWT Secret:      ${YELLOW}${JWT_SECRET}${NC}"
echo -e "  Anon Key:        ${YELLOW}${ANON_KEY}${NC}"
echo -e "  Service Role Key:${YELLOW}${SERVICE_ROLE_KEY}${NC}"
echo ""
echo -e "${RED}  IMPORTANTE: Salve essas credenciais em local seguro!${NC}"
echo ""

# Salvar credenciais em arquivo
cat > "${PROJECT_DIR}/.credentials" <<EOF
# Credenciais geradas em $(date)
# NAO COMPARTILHE ESTE ARQUIVO!

DOMAIN=${DOMAIN}
API_DOMAIN=${API_DOMAIN}
DB_PASSWORD=${DB_PASSWORD}
DB_PORT=${DB_PORT}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
EOF

chmod 600 "${PROJECT_DIR}/.credentials"
log_info "Credenciais salvas em ${PROJECT_DIR}/.credentials"
echo ""
