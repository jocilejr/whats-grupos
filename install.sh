#!/bin/bash
set -euo pipefail

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

die() {
  log_error "$1"
  exit 1
}

# ============================================================
# Verificacoes iniciais
# ============================================================

if [ "$EUID" -ne 0 ]; then
  die "Execute como root: sudo ./install.sh"
fi

if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  die "Este instalador requer Ubuntu 22.04 ou superior."
fi

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ============================================================
# Detectar Traefik no Docker Swarm
# ============================================================

USE_TRAEFIK=false
TRAEFIK_NETWORK=""
TRAEFIK_DYNAMIC_DIR=""
CERT_RESOLVER="letsencryptresolver"

if command -v docker &>/dev/null; then
  SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
  if [ "$SWARM_STATE" = "active" ]; then
    TRAEFIK_SERVICE=$(docker service ls --format '{{.Name}}' 2>/dev/null | grep -i traefik | head -1 || true)
    if [ -n "$TRAEFIK_SERVICE" ]; then
      USE_TRAEFIK=true
      log_info "Traefik detectado no Docker Swarm (servico: ${TRAEFIK_SERVICE})"

      # Detectar rede do Traefik
      TRAEFIK_NETWORK=$(docker service inspect "$TRAEFIK_SERVICE" --format '{{range .Spec.TaskTemplate.Networks}}{{.Target}} {{end}}' 2>/dev/null | xargs || true)
      if [ -n "$TRAEFIK_NETWORK" ]; then
        TRAEFIK_NETWORK=$(docker network inspect "$TRAEFIK_NETWORK" --format '{{.Name}}' 2>/dev/null || echo "$TRAEFIK_NETWORK")
      fi
      if [ -z "$TRAEFIK_NETWORK" ]; then
        TRAEFIK_NETWORK=$(docker network ls --format '{{.Name}}' | grep -iE 'traefik.*(public|net)' | head -1 || true)
      fi
      if [ -z "$TRAEFIK_NETWORK" ]; then
        TRAEFIK_NETWORK="traefik-public"
      fi
      log_info "Rede do Traefik: ${TRAEFIK_NETWORK}"

      # Detectar certresolver e file provider
      TRAEFIK_CONTAINER=$(docker ps -q -f name=traefik | head -1 || true)
      TRAEFIK_CONFIG=""
      if [ -n "$TRAEFIK_CONTAINER" ]; then
        TRAEFIK_CONFIG=$(docker exec "$TRAEFIK_CONTAINER" cat /etc/traefik/traefik.yml 2>/dev/null || \
                         docker exec "$TRAEFIK_CONTAINER" cat /traefik.yml 2>/dev/null || echo "")
      fi

      if [ -n "$TRAEFIK_CONFIG" ]; then
        DETECTED_RESOLVER=$(echo "$TRAEFIK_CONFIG" | grep -A1 "certificatesResolvers" | grep -oP '^\s+\K\w+' | head -1 || true)
        if [ -n "$DETECTED_RESOLVER" ]; then
          CERT_RESOLVER="$DETECTED_RESOLVER"
        fi
        TRAEFIK_DYNAMIC_DIR=$(echo "$TRAEFIK_CONFIG" | grep -A5 "file:" | grep "directory:" | sed 's/.*directory:\s*//' | tr -d '"' | tr -d "'" | xargs || true)
      else
        SERVICE_ARGS=$(docker service inspect "$TRAEFIK_SERVICE" --format '{{range .Spec.TaskTemplate.ContainerSpec.Args}}{{.}} {{end}}' 2>/dev/null || true)
        if [ -n "$SERVICE_ARGS" ]; then
          DETECTED_RESOLVER=$(echo "$SERVICE_ARGS" | grep -oP 'certificatesresolvers\.\K[^.]+' | head -1 || true)
          if [ -n "$DETECTED_RESOLVER" ]; then
            CERT_RESOLVER="$DETECTED_RESOLVER"
          fi
          DETECTED_DIR=$(echo "$SERVICE_ARGS" | grep -oP 'providers\.file\.directory=\K[^\s]+' || true)
          if [ -n "$DETECTED_DIR" ]; then
            TRAEFIK_DYNAMIC_DIR="$DETECTED_DIR"
          fi
        fi
      fi
      log_info "Cert resolver: ${CERT_RESOLVER}"
      if [ -n "$TRAEFIK_DYNAMIC_DIR" ]; then
        log_info "File provider dir: ${TRAEFIK_DYNAMIC_DIR}"
      fi
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
  die "Dominio e obrigatorio."
fi

# Limpar protocolo, www e barra final
DOMAIN=$(echo "$DOMAIN" | sed -e 's|^https\?://||' -e 's|/$||' -e 's|^www\.||' | xargs)

if [[ ! "$DOMAIN" =~ \. ]]; then
  die "Dominio invalido: '${DOMAIN}'. Use o formato: meusistema.com"
fi

SSL_EMAIL=""
if [ "$USE_TRAEFIK" = false ]; then
  read -p "Digite seu email (para certificado SSL): " SSL_EMAIL
  if [ -z "$SSL_EMAIL" ]; then
    die "Email e obrigatorio para o SSL."
  fi
fi

read -sp "Senha do banco de dados (Enter para gerar automaticamente): " DB_PASSWORD
echo ""
if [ -z "$DB_PASSWORD" ]; then
  DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
  log_info "Senha do banco gerada automaticamente."
fi

# ---- Admin credentials ----
echo ""
echo -e "${CYAN}Configuracao da conta administrador:${NC}"
read -p "Email do administrador: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
  die "Email do administrador e obrigatorio."
fi
if [[ ! "$ADMIN_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
  die "Email invalido: '${ADMIN_EMAIL}'"
fi

while true; do
  read -sp "Senha do administrador (minimo 6 caracteres): " ADMIN_PASSWORD
  echo ""
  if [ ${#ADMIN_PASSWORD} -lt 6 ]; then
    log_warn "Senha deve ter no minimo 6 caracteres. Tente novamente."
  else
    break
  fi
done

API_DOMAIN="api.${DOMAIN}"
SUPABASE_DIR="/opt/supabase-docker"

echo ""
log_info "Dominio frontend: ${DOMAIN}"
log_info "Dominio API:      ${API_DOMAIN}"
log_info "Admin email:      ${ADMIN_EMAIL}"
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
# 1/9 - Instalar dependencias do sistema
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

  log_info "Instalando/verificando Certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx
  log_success "Certbot pronto."
fi

log_success "Todas as dependencias instaladas."

# ============================================================
# 2/9 - Configurar Supabase Self-Hosted
# ============================================================

log_step "2/9 - Configurando Supabase Self-Hosted"

# Gerar chaves JWT
log_info "Gerando chaves JWT..."
JWT_SECRET=$(openssl rand -base64 32)

chmod +x "${PROJECT_DIR}/scripts/generate-keys.sh"
KEYS_OUTPUT=$(bash "${PROJECT_DIR}/scripts/generate-keys.sh" "$JWT_SECRET")
ANON_KEY=$(echo "$KEYS_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2-)
SERVICE_ROLE_KEY=$(echo "$KEYS_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2-)

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  die "Falha ao gerar chaves JWT. Verifique se Node.js esta instalado."
fi

log_success "Chaves JWT geradas."

# Clonar Supabase Docker
if [ -d "$SUPABASE_DIR" ]; then
  log_warn "Diretorio Supabase ja existe. Parando containers existentes..."
  cd "${SUPABASE_DIR}/docker" 2>/dev/null && docker compose down 2>/dev/null || true
  cd "$PROJECT_DIR"
else
  log_info "Clonando Supabase Docker..."
  git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR"
fi

cd "${SUPABASE_DIR}/docker"

# Verificar se porta 5432 esta em uso
DB_PORT=5432
if ss -tlnp | grep -q ":${DB_PORT} "; then
  log_warn "Porta ${DB_PORT} em uso. Procurando porta alternativa..."
  DB_PORT=0
  for PORT in 5433 5434 5435 5436 5437; do
    if ! ss -tlnp | grep -q ":${PORT} "; then
      DB_PORT=$PORT
      break
    fi
  done
  if [ "$DB_PORT" -eq 0 ]; then
    die "Nenhuma porta alternativa disponivel (5432-5437)."
  fi
  log_info "Usando porta alternativa: ${DB_PORT}"
fi

# Copiar e configurar .env
cp -n .env.example .env 2>/dev/null || true

# Gerar secrets
DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')
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

# Alterar porta do PostgreSQL se necessario
if [ "$DB_PORT" -ne 5432 ]; then
  log_info "Alterando POSTGRES_PORT no .env para ${DB_PORT}..."
  if grep -q "POSTGRES_PORT=" .env; then
    sed -i "s|POSTGRES_PORT=.*|POSTGRES_PORT=${DB_PORT}|" .env
  else
    echo "POSTGRES_PORT=${DB_PORT}" >> .env
  fi
fi

# Expor Kong apenas no localhost (necessario para criar admin e cron)
log_info "Configurando Kong para acesso interno (127.0.0.1:8000)..."
sed -i -E 's/^(\s*-\s*"?\$\{KONG_HTTP_PORT\}:8000"?)$/# \1/' docker-compose.yml 2>/dev/null || true
sed -i -E 's/^(\s*-\s*"8000:8000")$/# \1/' docker-compose.yml 2>/dev/null || true

# Adicionar porta 8000 exposta no localhost no servico kong
# Procurar a secao ports do kong e adicionar 127.0.0.1:8000:8000
if ! grep -q "127.0.0.1:8000:8000" docker-compose.yml; then
  sed -i '/kong:/,/^  [a-z]/{/ports:/a\      - "127.0.0.1:8000:8000"' docker-compose.yml 2>/dev/null || true
fi

# Subir containers
log_info "Subindo containers do Supabase (pode demorar alguns minutos)..."
docker compose pull -q 2>/dev/null || log_warn "Falha ao baixar imagens (usando cache)."
docker compose up -d || die "Falha ao subir containers do Supabase."

# Aguardar o banco ficar pronto
log_info "Aguardando banco de dados ficar pronto..."
READY=false
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres &>/dev/null; then
    READY=true
    break
  fi
  sleep 2
done

if [ "$READY" = false ]; then
  die "Banco de dados nao ficou pronto em 60 segundos. Verifique os logs: docker compose logs db"
fi

log_success "Supabase rodando."

# ============================================================
# 3/9 - Corrigir senhas internas do PostgreSQL
# ============================================================

log_step "3/9 - Sincronizando senhas do PostgreSQL"

chmod +x "${PROJECT_DIR}/scripts/fix-pg-passwords.sh"
bash "${PROJECT_DIR}/scripts/fix-pg-passwords.sh" "${DB_PASSWORD}" || die "Falha ao sincronizar senhas do PostgreSQL."

log_success "Senhas do PostgreSQL sincronizadas."

# ============================================================
# 4/9 - Executar migracoes do banco
# ============================================================

log_step "4/9 - Executando migracoes do banco"

chmod +x "${PROJECT_DIR}/scripts/run-migrations.sh"
bash "${PROJECT_DIR}/scripts/run-migrations.sh" "${PROJECT_DIR}/supabase/migrations" "${DB_PASSWORD}" "${DB_PORT}" || die "Falha ao executar migracoes."

log_success "Migracoes executadas."

# ============================================================
# 5/9 - Habilitar extensoes pg_cron e pg_net
# ============================================================

log_step "5/9 - Habilitando extensoes do banco"

cd "${SUPABASE_DIR}/docker"

docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_cron CASCADE;" 2>/dev/null || log_warn "pg_cron pode nao estar disponivel."
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_net CASCADE;" 2>/dev/null || log_warn "pg_net pode nao estar disponivel."

log_success "Extensoes do banco configuradas."

# ============================================================
# 6/9 - Configurar cron job
# ============================================================

log_step "6/9 - Configurando cron job para mensagens agendadas"

chmod +x "${PROJECT_DIR}/scripts/setup-cron.sh"
bash "${PROJECT_DIR}/scripts/setup-cron.sh" "${SUPABASE_DIR}" "${API_DOMAIN}" "${ANON_KEY}" "${DB_PASSWORD}" || die "Falha ao configurar cron job."

log_success "Cron job configurado."

# ============================================================
# 7/9 - Deploy das Edge Functions (TODAS)
# ============================================================

log_step "7/9 - Fazendo deploy das Edge Functions"

FUNCTIONS_DIR="${SUPABASE_DIR}/docker/volumes/functions"
mkdir -p "$FUNCTIONS_DIR"

# Lista de todas as edge functions do projeto
EDGE_FUNCTIONS="evolution-api send-scheduled-messages admin-api backup-export generate-ai-message process-queue"

for FUNC_NAME in $EDGE_FUNCTIONS; do
  if [ -d "${PROJECT_DIR}/supabase/functions/${FUNC_NAME}" ]; then
    cp -r "${PROJECT_DIR}/supabase/functions/${FUNC_NAME}" "$FUNCTIONS_DIR/"
    log_success "Edge function '${FUNC_NAME}' copiada."
  else
    log_warn "Edge function '${FUNC_NAME}' nao encontrada em supabase/functions/."
  fi
done

cd "${SUPABASE_DIR}/docker"
docker compose restart functions 2>/dev/null || log_warn "Container 'functions' nao encontrado."

log_success "Edge Functions deployadas."

# ============================================================
# 8/9 - Criar conta administrador
# ============================================================

log_step "8/9 - Criando conta administrador"

# Aguardar todos os servicos ficarem prontos
log_info "Aguardando servicos ficarem prontos..."
sleep 10

chmod +x "${PROJECT_DIR}/scripts/create-admin.sh"
bash "${PROJECT_DIR}/scripts/create-admin.sh" \
  "${SERVICE_ROLE_KEY}" \
  "${ANON_KEY}" \
  "${ADMIN_EMAIL}" \
  "${ADMIN_PASSWORD}" \
  "${DB_PASSWORD}" \
  "${DB_PORT}" \
  || die "Falha ao criar conta administrador."

log_success "Conta administrador criada."

# ============================================================
# 9/9 - Buildar frontend + proxy reverso
# ============================================================

log_step "9/9 - Buildando frontend e configurando proxy"

cd "$PROJECT_DIR"

cat > .env.production <<EOF
VITE_SUPABASE_URL=https://${API_DOMAIN}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=self-hosted
EOF

log_info "Instalando dependencias do frontend..."
npm install --production=false || die "Falha ao instalar dependencias."

log_info "Buildando aplicacao..."
npm run build || die "Falha ao buildar o frontend."

log_success "Frontend buildado em dist/."

# ---- Configurar proxy reverso ----

if [ "$USE_TRAEFIK" = true ]; then

  # Desabilitar Nginx do host se estiver rodando
  if systemctl is-active nginx &>/dev/null; then
    log_info "Desabilitando Nginx do host (Traefik assume o roteamento)..."
    systemctl stop nginx 2>/dev/null || true
    systemctl disable nginx 2>/dev/null || true
    log_success "Nginx do host desabilitado."
  fi

  # Configurar rota da API via Traefik
  TEMP_API_YML=$(mktemp)
  sed "s|{{API_DOMAIN}}|${API_DOMAIN}|g; s|{{CERT_RESOLVER}}|${CERT_RESOLVER}|g; s|{{FRONTEND_DOMAIN}}|${DOMAIN}|g" \
    "${PROJECT_DIR}/traefik/supabase-api.yml" \
    > "$TEMP_API_YML"

  API_ROUTE_OK=false

  if [ -n "$TRAEFIK_DYNAMIC_DIR" ]; then
    TRAEFIK_CONTAINER=$(docker ps -q -f name=traefik | head -1 || true)
    if [ -n "$TRAEFIK_CONTAINER" ]; then
      HOST_DYNAMIC_DIR=$(docker inspect "$TRAEFIK_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "'"$TRAEFIK_DYNAMIC_DIR"'"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)
      if [ -n "$HOST_DYNAMIC_DIR" ] && [ -d "$HOST_DYNAMIC_DIR" ]; then
        cp "$TEMP_API_YML" "${HOST_DYNAMIC_DIR}/supabase-api.yml"
        API_ROUTE_OK=true
        log_success "Rota da API copiada para ${HOST_DYNAMIC_DIR}/supabase-api.yml"
      fi
    fi
  fi

  if [ "$API_ROUTE_OK" = false ]; then
    TRAEFIK_CONTAINER=$(docker ps -q -f name=traefik | head -1 || true)
    if [ -n "$TRAEFIK_CONTAINER" ]; then
      TARGET_DIR="${TRAEFIK_DYNAMIC_DIR:-/etc/traefik/dynamic}"
      docker exec "$TRAEFIK_CONTAINER" mkdir -p "$TARGET_DIR" 2>/dev/null || true
      docker cp "$TEMP_API_YML" "${TRAEFIK_CONTAINER}:${TARGET_DIR}/supabase-api.yml"
      if [ $? -eq 0 ]; then
        API_ROUTE_OK=true
        log_success "Rota da API copiada via docker cp para ${TARGET_DIR}/supabase-api.yml"
      fi
    fi
  fi

  rm -f "$TEMP_API_YML"

  if [ "$API_ROUTE_OK" = false ]; then
    log_warn "Nao foi possivel configurar a rota da API automaticamente."
    log_warn "Copie manualmente: docker cp traefik/supabase-api.yml <container>:/etc/traefik/dynamic/"
  fi

  # Deploy do frontend como stack no Swarm
  log_info "Deployando frontend no Docker Swarm..."
  export FRONTEND_DOMAIN="$DOMAIN"
  export CERT_RESOLVER="$CERT_RESOLVER"
  export TRAEFIK_NETWORK="$TRAEFIK_NETWORK"

  cd "$PROJECT_DIR"

  docker stack rm whats-frontend 2>/dev/null || true
  sleep 3

  docker stack deploy -c docker-compose.frontend.yml whats-frontend || die "Falha ao deployar frontend no Swarm."

  log_success "Frontend deployado via Traefik."

else

  # ---- Nginx ----
  HTTP_PORT=80

  rm -f /etc/nginx/sites-enabled/default

  sed "s|{{DOMAIN}}|${DOMAIN}|g; s|{{PROJECT_DIR}}|${PROJECT_DIR}|g; s|{{HTTP_PORT}}|${HTTP_PORT}|g" \
    "${PROJECT_DIR}/nginx/frontend.conf.template" \
    > /etc/nginx/sites-available/whats-grupos

  sed "s|{{API_DOMAIN}}|${API_DOMAIN}|g; s|{{HTTP_PORT}}|${HTTP_PORT}|g" \
    "${PROJECT_DIR}/nginx/api.conf.template" \
    > /etc/nginx/sites-available/whats-grupos-api

  ln -sf /etc/nginx/sites-available/whats-grupos /etc/nginx/sites-enabled/
  ln -sf /etc/nginx/sites-available/whats-grupos-api /etc/nginx/sites-enabled/

  nginx -t || die "Configuracao do Nginx invalida."

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
echo -e "  ${GREEN}Conta Administrador:${NC}"
echo -e "    Email: ${YELLOW}${ADMIN_EMAIL}${NC}"
echo -e "    Senha: ${YELLOW}${ADMIN_PASSWORD}${NC}"
echo ""
echo -e "  Studio Login:"
echo -e "    Usuario: ${YELLOW}admin${NC}"
echo -e "    Senha:   ${YELLOW}${DASHBOARD_PASSWORD}${NC}"
echo ""
echo -e "  Banco de Dados:"
echo -e "    Senha:   ${YELLOW}${DB_PASSWORD}${NC}"
echo -e "    Porta:   ${YELLOW}${DB_PORT}${NC}"
echo ""
echo -e "  JWT Secret:       ${YELLOW}${JWT_SECRET}${NC}"
echo -e "  Anon Key:         ${YELLOW}${ANON_KEY}${NC}"
echo -e "  Service Role Key: ${YELLOW}${SERVICE_ROLE_KEY}${NC}"
echo ""
if [ "$USE_TRAEFIK" = true ]; then
  echo -e "  Proxy:           ${CYAN}Traefik (Docker Swarm)${NC}"
  echo -e "  Rede Traefik:    ${CYAN}${TRAEFIK_NETWORK}${NC}"
  echo -e "  Cert Resolver:   ${CYAN}${CERT_RESOLVER}${NC}"
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
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
USE_TRAEFIK=${USE_TRAEFIK}
TRAEFIK_NETWORK=${TRAEFIK_NETWORK}
CERT_RESOLVER=${CERT_RESOLVER}
EOF

chmod 600 "${PROJECT_DIR}/.credentials"
log_info "Credenciais salvas em ${PROJECT_DIR}/.credentials"
echo ""
