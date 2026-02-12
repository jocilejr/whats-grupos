#!/bin/bash
set -e

# ============================================================
# Instalador Automatico - WhatsApp Grupos
# Instala Frontend + Supabase Self-Hosted em VPS Ubuntu
# Suporta Traefik (Docker Swarm) ou Nginx como reverse proxy
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

# ============================================================
# Detectar Traefik no Docker Swarm
# ============================================================

USE_TRAEFIK=false
TRAEFIK_NETWORK=""
CERT_RESOLVER="letsencryptresolver"

if command -v docker &>/dev/null; then
  SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
  if [ "$SWARM_STATE" = "active" ]; then
    # Procurar servico Traefik
    TRAEFIK_SERVICE=$(docker service ls --format '{{.Name}}' 2>/dev/null | grep -i traefik | head -1)
    if [ -n "$TRAEFIK_SERVICE" ]; then
      USE_TRAEFIK=true
      log_info "Traefik detectado no Docker Swarm (servico: ${TRAEFIK_SERVICE})"

      # Detectar rede do Traefik
      TRAEFIK_NETWORK=$(docker service inspect "$TRAEFIK_SERVICE" --format '{{range .Spec.TaskTemplate.Networks}}{{.Target}} {{end}}' 2>/dev/null | xargs)
      if [ -n "$TRAEFIK_NETWORK" ]; then
        # Resolver ID para nome
        TRAEFIK_NETWORK=$(docker network inspect "$TRAEFIK_NETWORK" --format '{{.Name}}' 2>/dev/null || echo "$TRAEFIK_NETWORK")
      fi
      # Fallback para nome padrao
      if [ -z "$TRAEFIK_NETWORK" ]; then
        TRAEFIK_NETWORK=$(docker network ls --format '{{.Name}}' | grep -i traefik | head -1)
      fi
      if [ -z "$TRAEFIK_NETWORK" ]; then
        TRAEFIK_NETWORK="traefik-public"
      fi
      log_info "Rede do Traefik: ${TRAEFIK_NETWORK}"

      # Detectar certresolver
      TRAEFIK_CONTAINER=$(docker ps -q -f name=traefik | head -1)
      if [ -n "$TRAEFIK_CONTAINER" ]; then
        TRAEFIK_CONFIG=$(docker exec "$TRAEFIK_CONTAINER" cat /etc/traefik/traefik.yml 2>/dev/null || \
                         docker exec "$TRAEFIK_CONTAINER" cat /traefik.yml 2>/dev/null || echo "")
        if [ -n "$TRAEFIK_CONFIG" ]; then
          DETECTED_RESOLVER=$(echo "$TRAEFIK_CONFIG" | grep -A1 "certificatesResolvers" | grep -oP '^\s+\K\w+' | head -1)
          if [ -n "$DETECTED_RESOLVER" ]; then
            CERT_RESOLVER="$DETECTED_RESOLVER"
          fi
        fi

        # Detectar caminho do file provider
        TRAEFIK_DYNAMIC_DIR=$(echo "$TRAEFIK_CONFIG" | grep -A5 "file:" | grep "directory:" | sed 's/.*directory:\s*//' | tr -d '"' | tr -d "'" | xargs)
      fi
      log_info "Cert resolver: ${CERT_RESOLVER}"
    fi
  fi
fi

log_step "Instalador Automatico - WhatsApp Grupos"
echo "Este script vai instalar:"
echo "  - Docker e Docker Compose"
echo "  - Supabase Self-Hosted (banco, auth, storage, edge functions)"
echo "  - Node.js 20 e build do frontend"
if [ "$USE_TRAEFIK" = true ]; then
  echo "  - Roteamento via Traefik (detectado no Swarm)"
else
  echo "  - Nginx com SSL (Certbot)"
fi
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

if [ "$USE_TRAEFIK" = false ]; then
  read -p "Digite seu email (para certificado SSL): " SSL_EMAIL
  if [ -z "$SSL_EMAIL" ]; then
    log_error "Email e obrigatorio para o SSL."
    exit 1
  fi
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
if [ "$USE_TRAEFIK" = true ]; then
  log_info "Proxy reverso:    Traefik (Docker Swarm)"
else
  log_info "Proxy reverso:    Nginx + Certbot"
fi
echo ""
read -p "Confirma a instalacao? (s/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
  log_warn "Instalacao cancelada."
  exit 0
fi

# ============================================================
# 1. Instalar dependencias do sistema
# ============================================================

log_step "1/8 - Instalando dependencias do sistema"

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

# Nginx (apenas se nao usar Traefik)
if [ "$USE_TRAEFIK" = false ]; then
  if ! command -v nginx &>/dev/null; then
    log_info "Instalando Nginx..."
    apt-get install -y -qq nginx
    systemctl enable nginx
    log_success "Nginx instalado."
  else
    log_success "Nginx ja instalado."
  fi

  # Certbot
  log_info "Instalando/verificando Certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx
  log_success "Certbot pronto."
fi

log_success "Todas as dependencias instaladas."

# ============================================================
# 2. Configurar Supabase Self-Hosted
# ============================================================

log_step "2/8 - Configurando Supabase Self-Hosted"

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
  log_info "Alterando POSTGRES_PORT no .env para ${DB_PORT}..."
  sed -i "s|POSTGRES_PORT=.*|POSTGRES_PORT=${DB_PORT}|" .env
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

# Se usando Traefik, remover porta 80 do Kong (Traefik sera o gateway)
# Se usando Nginx, tambem remover (Nginx sera o gateway)
log_info "Configurando Kong para acesso apenas interno..."
cd "${SUPABASE_DIR}/docker"
sed -i 's/- "${KONG_HTTP_PORT}:8000"/# - "${KONG_HTTP_PORT}:8000"/' docker-compose.yml
sed -i 's/- "8000:8000"/# - "8000:8000"/' docker-compose.yml
docker compose up -d kong --force-recreate
log_success "Kong configurado para acesso apenas interno."

# ============================================================
# 3. Executar migracoes do banco
# ============================================================

log_step "3/8 - Executando migracoes do banco"

chmod +x "${PROJECT_DIR}/scripts/run-migrations.sh"
bash "${PROJECT_DIR}/scripts/run-migrations.sh" "${PROJECT_DIR}/supabase/migrations" "${DB_PASSWORD}" "${DB_PORT}"
check_error "Falha ao executar migracoes."

log_success "Migracoes executadas."

# ============================================================
# 4. Habilitar extensoes pg_cron e pg_net
# ============================================================

log_step "4/8 - Habilitando extensoes do banco"

cd "${SUPABASE_DIR}/docker"

docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_cron CASCADE;" 2>/dev/null || true
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_net CASCADE;" 2>/dev/null || true

log_success "Extensoes pg_cron e pg_net habilitadas."

# ============================================================
# 5. Configurar cron job
# ============================================================

log_step "5/8 - Configurando cron job para mensagens agendadas"

chmod +x "${PROJECT_DIR}/scripts/setup-cron.sh"
bash "${PROJECT_DIR}/scripts/setup-cron.sh" "${SUPABASE_DIR}" "${API_DOMAIN}" "${ANON_KEY}" "${DB_PASSWORD}"
check_error "Falha ao configurar cron job."

log_success "Cron job configurado."

# ============================================================
# 6. Deploy das Edge Functions
# ============================================================

log_step "6/8 - Fazendo deploy das Edge Functions"

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

cd "${SUPABASE_DIR}/docker"
docker compose restart functions 2>/dev/null || log_warn "Container 'functions' nao encontrado."

log_success "Edge Functions deployadas."

# ============================================================
# 7. Buildar o frontend
# ============================================================

log_step "7/8 - Buildando o frontend"

cd "$PROJECT_DIR"

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
# 8. Configurar proxy reverso (Traefik ou Nginx)
# ============================================================

if [ "$USE_TRAEFIK" = true ]; then

  log_step "8/8 - Configurando roteamento via Traefik"

  # Desabilitar Nginx do host se estiver rodando
  if systemctl is-active nginx &>/dev/null; then
    log_info "Desabilitando Nginx do host (Traefik assume o roteamento)..."
    systemctl stop nginx 2>/dev/null || true
    systemctl disable nginx 2>/dev/null || true
    log_success "Nginx do host desabilitado."
  fi

  # Configurar rota dinamica do Traefik para a API (Supabase Kong)
  if [ -n "$TRAEFIK_DYNAMIC_DIR" ]; then
    log_info "Criando rota Traefik para API em ${TRAEFIK_DYNAMIC_DIR}..."
    mkdir -p "$TRAEFIK_DYNAMIC_DIR"
      sed "s|{{API_DOMAIN}}|${API_DOMAIN}|g; s|{{CERT_RESOLVER}}|${CERT_RESOLVER}|g" \
        "${PROJECT_DIR}/traefik/supabase-api.yml" \
        > "${TRAEFIK_DYNAMIC_DIR}/supabase-api.yml"
      log_success "Rota da API configurada no Traefik."
    else
      # Copiar via docker cp para dentro do container do Traefik
      log_info "Copiando rota da API via docker cp para o container do Traefik..."
      TRAEFIK_CONTAINER=$(docker ps -q -f name=traefik | head -1)
      if [ -n "$TRAEFIK_CONTAINER" ]; then
        # Gerar arquivo temporario com placeholders substituidos
        TEMP_API_YML=$(mktemp)
        sed "s|{{API_DOMAIN}}|${API_DOMAIN}|g; s|{{CERT_RESOLVER}}|${CERT_RESOLVER}|g" \
          "${PROJECT_DIR}/traefik/supabase-api.yml" \
          > "$TEMP_API_YML"
        docker cp "$TEMP_API_YML" "${TRAEFIK_CONTAINER}:/etc/traefik/dynamic/supabase-api.yml"
        rm -f "$TEMP_API_YML"
        log_success "Rota da API copiada para o container do Traefik."
      else
        log_warn "Container do Traefik nao encontrado. Copie manualmente:"
        log_warn "  docker cp traefik/supabase-api.yml <traefik_container>:/etc/traefik/dynamic/"
      fi
    fi

  # Deploy do frontend como stack no Swarm
  log_info "Deployando frontend no Docker Swarm..."
  export FRONTEND_DOMAIN="$DOMAIN"
  export CERT_RESOLVER="$CERT_RESOLVER"
  export TRAEFIK_NETWORK="$TRAEFIK_NETWORK"

  cd "$PROJECT_DIR"
  docker stack deploy -c docker-compose.frontend.yml whats-frontend
  check_error "Falha ao deployar frontend no Swarm."

  log_success "Frontend deployado via Traefik."

else

  log_step "8/8 - Configurando Nginx + SSL"

  HTTP_PORT=80

  # Remover config default
  rm -f /etc/nginx/sites-enabled/default

  # Frontend
  sed "s|{{DOMAIN}}|${DOMAIN}|g; s|{{PROJECT_DIR}}|${PROJECT_DIR}|g; s|{{HTTP_PORT}}|${HTTP_PORT}|g" \
    "${PROJECT_DIR}/nginx/frontend.conf.template" \
    > /etc/nginx/sites-available/whats-grupos

  # API proxy
  sed "s|{{API_DOMAIN}}|${API_DOMAIN}|g; s|{{HTTP_PORT}}|${HTTP_PORT}|g" \
    "${PROJECT_DIR}/nginx/api.conf.template" \
    > /etc/nginx/sites-available/whats-grupos-api

  ln -sf /etc/nginx/sites-available/whats-grupos /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/whats-grupos-api /etc/nginx/sites-enabled/

  nginx -t
  check_error "Configuracao do Nginx invalida."

  systemctl restart nginx
  log_success "Nginx configurado."

  # SSL
  if [ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
    mkdir -p /etc/letsencrypt
    cat > /etc/letsencrypt/options-ssl-nginx.conf <<'SSLCONF'
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384";
SSLCONF
    log_success "Arquivo options-ssl-nginx.conf criado."
  fi

  if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
    curl -sS https://raw.githubusercontent.com/certbot/certbot/main/certbot/certbot/ssl-dhparams.pem \
      -o /etc/letsencrypt/ssl-dhparams.pem
    log_success "Arquivo ssl-dhparams.pem baixado."
  fi

  certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" \
    --non-interactive --agree-tos -m "$SSL_EMAIL" 2>&1
  CERT_RESULT=$?

  if [ $CERT_RESULT -eq 0 ]; then
    log_success "SSL configurado automaticamente."
  else
    log_warn "SSL automatico falhou. Configure manualmente:"
    log_info "  certbot --nginx -d ${DOMAIN} -d ${API_DOMAIN} --agree-tos -m ${SSL_EMAIL}"
  fi

fi

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
if [ "$USE_TRAEFIK" = true ]; then
  echo -e "  Proxy:           ${CYAN}Traefik (Docker Swarm)${NC}"
  echo -e "  Rede Traefik:    ${CYAN}${TRAEFIK_NETWORK}${NC}"
fi
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
USE_TRAEFIK=${USE_TRAEFIK}
TRAEFIK_NETWORK=${TRAEFIK_NETWORK}
CERT_RESOLVER=${CERT_RESOLVER}
EOF

chmod 600 "${PROJECT_DIR}/.credentials"
log_info "Credenciais salvas em ${PROJECT_DIR}/.credentials"
echo ""
