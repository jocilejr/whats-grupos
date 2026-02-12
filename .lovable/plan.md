

# Correcao Real - Porta do Supabase via Variavel de Ambiente

## Problema raiz

O `docker-compose.yml` do Supabase **nao usa portas hardcoded**. Ele usa a variavel `${POSTGRES_PORT}` definida no arquivo `.env`:

```text
# No docker-compose.yml do pooler:
ports:
  - ${POSTGRES_PORT}:5432
```

Os comandos `sed` aplicados ao `docker-compose.yml` nao encontram `5432:5432` porque esse texto nao existe no arquivo. O valor vem do `.env` onde `POSTGRES_PORT=5432`.

## Solucao

Alterar o valor de `POSTGRES_PORT` no arquivo `.env` do Supabase em vez de tentar modificar o `docker-compose.yml`.

## Detalhe tecnico

No `install.sh`, substituir o bloco atual de alteracao de porta por:

```text
if [ "$DB_PORT" -ne 5432 ]; then
  log_info "Alterando POSTGRES_PORT no .env para ${DB_PORT}..."
  sed -i "s|POSTGRES_PORT=.*|POSTGRES_PORT=${DB_PORT}|" .env
fi
```

E **remover** os tres comandos `sed` que tentam alterar o `docker-compose.yml`, pois sao desnecessarios:

```text
# REMOVER estas linhas:
sed -i "s|5432:5432|${DB_PORT}:5432|g" docker-compose.yml
sed -i 's|"5432:|"'"${DB_PORT}"':|g' docker-compose.yml
sed -i 's|- 5432:|- '"${DB_PORT}"':|g' docker-compose.yml
```

Isso resolve o problema de forma limpa, pois tanto o servico `db` quanto o `pooler` leem a mesma variavel `POSTGRES_PORT` do `.env`.

