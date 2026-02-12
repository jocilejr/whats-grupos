#!/bin/bash
# Executa migracoes SQL no banco de dados do Supabase self-hosted
# Uso: ./run-migrations.sh <migrations_dir> <db_password>

MIGRATIONS_DIR="$1"
DB_PASSWORD="$2"

if [ -z "$MIGRATIONS_DIR" ] || [ -z "$DB_PASSWORD" ]; then
  echo "Uso: $0 <migrations_dir> <db_password>" >&2
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Diretorio de migracoes nao encontrado: $MIGRATIONS_DIR" >&2
  exit 1
fi

SUPABASE_DIR="/opt/supabase-docker/docker"

echo "[INFO] Executando migracoes de: $MIGRATIONS_DIR"

# Ordenar arquivos por nome (cronologico)
for SQL_FILE in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  FILENAME=$(basename "$SQL_FILE")
  echo "[INFO] Executando: $FILENAME"
  
  # Copiar SQL para o container e executar
  docker compose -f "${SUPABASE_DIR}/docker-compose.yml" exec -T db \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SQL_FILE"
  
  if [ $? -ne 0 ]; then
    echo "[ERRO] Falha ao executar: $FILENAME" >&2
    exit 1
  fi
  
  echo "[OK] $FILENAME executado."
done

echo "[OK] Todas as migracoes executadas com sucesso."
