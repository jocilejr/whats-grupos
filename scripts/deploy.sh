#!/bin/bash
# Script de atualizacao rapida
# Uso: sudo ./scripts/deploy.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "[INFO] Atualizando codigo..."
git pull

echo "[INFO] Instalando dependencias..."
npm install --production=false

echo "[INFO] Buildando frontend..."
npm run build

echo "[INFO] Atualizando edge functions..."
SUPABASE_DIR="/opt/supabase-docker"
FUNCTIONS_DIR="${SUPABASE_DIR}/docker/volumes/functions"

if [ -d "$FUNCTIONS_DIR" ]; then
  for FUNC in evolution-api send-scheduled-messages admin-api backup-export generate-ai-message process-queue sync-group-stats group-events-webhook smart-link-redirect sync-invite-links; do
    cp -r "supabase/functions/${FUNC}" "$FUNCTIONS_DIR/" 2>/dev/null || true
  done
  cd "${SUPABASE_DIR}/docker" && docker compose restart functions 2>/dev/null || true
  cd "$PROJECT_DIR"
fi

echo "[INFO] Atualizando Baileys Server..."
if [ -d "${PROJECT_DIR}/baileys-server" ]; then
  docker build -t baileys-server "${PROJECT_DIR}/baileys-server" 2>/dev/null && \
    docker rm -f baileys-server 2>/dev/null && \
    # Carregar .credentials para obter SERVICE_ROLE_KEY
    if [ -f "${PROJECT_DIR}/.credentials" ]; then
      source "${PROJECT_DIR}/.credentials"
    fi
    docker run -d --name baileys-server --restart unless-stopped \
      --network supabase_default \
      -e SUPABASE_FUNCTIONS_URL=http://supabase-kong:8000 \
      -e SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
      -p 127.0.0.1:3100:3100 -v baileys-data:/data baileys-server 2>/dev/null && \
    echo "[OK] Baileys Server atualizado." || \
    echo "[AVISO] Falha ao atualizar Baileys Server."
fi

echo "[INFO] Redeployando frontend no Swarm..."

# Carregar variaveis do .credentials se existir
if [ -f "${PROJECT_DIR}/.credentials" ]; then
  source "${PROJECT_DIR}/.credentials"
fi

# Defaults caso nao estejam definidos
export FRONTEND_DOMAIN="${DOMAIN:-app.simplificandogrupos.com}"
export CERT_RESOLVER="${CERT_RESOLVER:-letsencryptresolver}"
export TRAEFIK_NETWORK="${TRAEFIK_NETWORK:-traefik-public}"

# Atualizar config CORS do Traefik para a API
TRAEFIK_CONTAINER=$(docker ps -q -f name=traefik 2>/dev/null | head -1 || true)
if [ -n "$TRAEFIK_CONTAINER" ]; then
  TEMP_API_YML=$(mktemp)
  sed "s|{{API_DOMAIN}}|api.${FRONTEND_DOMAIN}|g; s|{{CERT_RESOLVER}}|${CERT_RESOLVER}|g; s|{{FRONTEND_DOMAIN}}|${FRONTEND_DOMAIN}|g" \
    "${PROJECT_DIR}/traefik/supabase-api.yml" \
    > "$TEMP_API_YML"
  docker cp "$TEMP_API_YML" "${TRAEFIK_CONTAINER}:/etc/traefik/dynamic/supabase-api.yml" 2>/dev/null && \
    echo "[INFO] Config CORS do Traefik atualizada." || \
    echo "[AVISO] Falha ao copiar config para Traefik."
  rm -f "$TEMP_API_YML"
fi

docker stack deploy -c docker-compose.frontend.yml whats-frontend 2>/dev/null || \
  echo "[AVISO] Falha ao redeployar stack. Verifique se o Docker Swarm esta ativo."

echo "[OK] Deploy concluido!"
