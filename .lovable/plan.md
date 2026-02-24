

## Corrigir erro "Unauthorized" na sync-group-stats

### Problema
A edge function `sync-group-stats` nao esta listada no `supabase/config.toml` com `verify_jwt = false`. O gateway rejeita a requisicao antes mesmo de chegar ao codigo da funcao.

### Solucao

**Arquivo:** `supabase/config.toml`

Adicionar a seguinte entrada:

```toml
[functions.sync-group-stats]
verify_jwt = false
```

Isso alinha a funcao com todas as outras funcoes do projeto que ja possuem `verify_jwt = false` (como `process-queue`, `send-scheduled-messages`, `group-events-webhook`, etc.).

A autenticacao continua sendo validada dentro do codigo da funcao, que ja verifica o header `Authorization` e chama `supabase.auth.getUser()`.

### Apos o deploy

Na VPS, sera necessario tambem copiar a funcao atualizada e reiniciar o container de functions. Alem disso, para testar via curl, usar o comando com `grep` para extrair a ANON_KEY corretamente:

```bash
ANON_KEY=$(grep '^ANON_KEY=' /opt/supabase-docker/docker/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'")

curl -s -X POST "https://api.app.simplificandogrupos.com/functions/v1/sync-group-stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" | jq
```

### Secao tecnica

- O `config.toml` e atualizado automaticamente no Lovable Cloud
- Na VPS self-hosted, apos `git pull` e `sudo ./scripts/deploy.sh`, a configuracao do Kong/gateway precisa ser atualizada manualmente ou via restart do container de functions
- A funcao ja faz validacao de auth internamente via `supabase.auth.getUser()`, entao desabilitar `verify_jwt` no gateway nao compromete a seguranca

