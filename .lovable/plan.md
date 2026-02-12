

# Correcao do Instalador - Porta Alternativa para PostgreSQL

## Problema

O Supabase Docker tenta usar a porta 5432, mas a VPS ja tem um PostgreSQL rodando nessa porta. O instalador nao deve parar nenhum servico existente.

## Solucao

Se a porta 5432 estiver ocupada, o instalador automaticamente usa a porta **5433** (ou a proxima disponivel) para o container PostgreSQL do Supabase. Os demais containers do Supabase se comunicam internamente via rede Docker, entao apenas a porta exposta no host precisa mudar.

## Detalhe tecnico

No `install.sh`, antes de subir os containers:

1. Verificar se a porta 5432 esta em uso com `ss -tlnp`
2. Se estiver, encontrar uma porta alternativa (5433, 5434, etc.)
3. Alterar o mapeamento de porta no `docker-compose.yml` do Supabase, trocando `5432:5432` por `5433:5432` (porta do host : porta interna do container)
4. Informar o usuario qual porta foi escolhida
5. Salvar a porta usada no arquivo `.credentials` para referencia futura

O trecho adicionado no `install.sh` sera algo como:

```text
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
  # Alterar mapeamento no docker-compose.yml
  sed -i "s|5432:5432|${DB_PORT}:5432|" docker-compose.yml
fi
```

A conexao interna entre os containers do Supabase (PostgREST, GoTrue, etc.) continua usando a porta 5432 dentro da rede Docker - apenas a porta exposta para o host muda. O script `run-migrations.sh` tambem sera atualizado para receber a porta como parametro.

