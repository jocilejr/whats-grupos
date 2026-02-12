

# Correcao do Instalador - Porta do Supabase Pooler

## Problema

O `docker-compose.yml` do Supabase tem **dois** servicos que mapeiam a porta 5432 no host:
1. `supabase-db` (PostgreSQL)
2. `supabase-pooler` (Supavisor/PgBouncer)

O `sed` atual troca todas as ocorrencias de `5432:5432`, mas o pooler pode ter um mapeamento em formato diferente (ex: `"5432:5432"`, ou porta interna diferente como `5432:4000`). Por isso o pooler ainda tenta usar a porta 5432 e falha.

## Solucao

Atualizar o bloco de troca de porta no `install.sh` para cobrir **todos os formatos possiveis** de mapeamento da porta 5432 no `docker-compose.yml`:

1. Trocar `5432:5432` (formato padrao do db)
2. Trocar qualquer outro mapeamento que exponha 5432 no host, como `"5432:XXXX"` onde XXXX pode ser outra porta interna (o pooler pode mapear `5432:4000` por exemplo)
3. Usar um sed mais abrangente que capture qualquer linha com `- "5432:` ou `- 5432:` e substitua a porta do host

### Detalhe tecnico

Substituir o bloco de alteracao de porta no `install.sh` por:

```text
if [ "$DB_PORT" -ne 5432 ]; then
  log_info "Alterando mapeamentos da porta 5432 no docker-compose.yml para ${DB_PORT}..."
  # Trocar TODAS as referencias de porta 5432 no host (db e pooler)
  sed -i "s|5432:5432|${DB_PORT}:5432|g" docker-compose.yml
  sed -i 's|"5432:|"'"${DB_PORT}"':|g' docker-compose.yml
  # Pooler pode ter porta interna diferente (ex: 5432:4000)
  sed -i 's|- 5432:|- '"${DB_PORT}"':|g' docker-compose.yml
fi
```

Isso garante que nenhum container tente expor a porta 5432 no host, independente do formato usado no compose file.

Tambem sera necessario atualizar o script `setup-cron.sh` para usar `DB_PORT` na conexao, ja que o cron pode conectar via host.

