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
  cp -r supabase/functions/evolution-api "$FUNCTIONS_DIR/" 2>/dev/null || true
  cp -r supabase/functions/send-scheduled-messages "$FUNCTIONS_DIR/" 2>/dev/null || true
  cd "${SUPABASE_DIR}/docker" && docker compose restart functions 2>/dev/null || true
fi

echo "[OK] Deploy concluido!"
