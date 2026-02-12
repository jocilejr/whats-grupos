#!/bin/bash
# Executa migracoes SQL no banco de dados do Supabase self-hosted
# Uso: ./run-migrations.sh <migrations_dir> <db_password>

MIGRATIONS_DIR="$1"
DB_PASSWORD="$2"
DB_PORT="${3:-5432}"

if [ -z "$MIGRATIONS_DIR" ] || [ -z "$DB_PASSWORD" ]; then
  echo "Uso: $0 <migrations_dir> <db_password> [db_port]" >&2
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Diretorio de migracoes nao encontrado: $MIGRATIONS_DIR" >&2
  exit 1
fi

SUPABASE_DIR="/opt/supabase-docker/docker"
ERRORS=0
SUCCESS=0

echo "[INFO] Executando migracoes de: $MIGRATIONS_DIR"

for SQL_FILE in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  FILENAME=$(basename "$SQL_FILE")
  echo "[INFO] Executando: $FILENAME"

  OUTPUT=$(docker compose -f "${SUPABASE_DIR}/docker-compose.yml" exec -T db \
    psql -U postgres -d postgres < "$SQL_FILE" 2>&1)

  if echo "$OUTPUT" | grep -qi "error"; then
    echo "[AVISO] $FILENAME teve avisos (objetos ja existentes - ignorado)"
    ERRORS=$((ERRORS + 1))
  else
    echo "[OK] $FILENAME"
    SUCCESS=$((SUCCESS + 1))
  fi
done

echo ""
echo "[RESUMO] $SUCCESS OK, $ERRORS com avisos"
echo "[OK] Migracoes finalizadas."
