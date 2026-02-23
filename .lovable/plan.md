

# Corrigir Deploy das Edge Functions na VPS

## Problema

O script `deploy.sh` nao inclui as duas novas edge functions na lista de funcoes copiadas para a VPS:
- `sync-group-stats`
- `group-events-webhook`

Isso causa o erro **500** ao clicar "Sincronizar Agora" e impede o recebimento de webhooks de eventos de grupo.

Alem disso, os erros **404** em `rest/v1/group_participant_events` indicam que a tabela ou as politicas RLS ainda nao estao corretas na VPS.

## Solucao

### 1. Atualizar `scripts/deploy.sh`

Adicionar `sync-group-stats` e `group-events-webhook` na lista de funcoes da linha 24:

```text
Antes:
  for FUNC in evolution-api send-scheduled-messages admin-api backup-export generate-ai-message process-queue; do

Depois:
  for FUNC in evolution-api send-scheduled-messages admin-api backup-export generate-ai-message process-queue sync-group-stats group-events-webhook; do
```

### 2. Acao manual na VPS

Apos o deploy aqui no Lovable, o usuario deve executar na VPS:

**Passo 1 — Corrigir as politicas RLS (caso ainda nao tenha feito):**

```bash
docker compose -f /opt/supabase-docker/docker/docker-compose.yml exec -T db psql -U postgres -d postgres <<'EOF'
DROP POLICY IF EXISTS "Users read own instance events" ON public.group_participant_events;
DROP POLICY IF EXISTS "Service role can insert events" ON public.group_participant_events;
CREATE POLICY "Users read own instance events" ON public.group_participant_events
  FOR SELECT USING (
    instance_name IN (
      SELECT ac.instance_name FROM api_configs ac WHERE ac.user_id = auth.uid()
    )
  );
CREATE POLICY "Service role can insert events" ON public.group_participant_events
  FOR INSERT WITH CHECK (true);
EOF
```

**Passo 2 — Atualizar codigo e redeployar:**

```bash
cd /opt/whats-grupos && git pull && sudo ./scripts/deploy.sh
```

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `scripts/deploy.sh` | Adicionar `sync-group-stats` e `group-events-webhook` na lista de funcoes |

## Detalhes tecnicos

O script `deploy.sh` copia as edge functions do repositorio para o diretorio de volumes do Supabase self-hosted e reinicia o container `functions`. Sem as novas funcoes na lista, elas nunca sao implantadas no ambiente de producao, resultando em erro 500 quando o frontend tenta invoca-las.
