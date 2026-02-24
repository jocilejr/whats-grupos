

# Deploy do Smart Link na VPS

## Resumo

Duas mudancas necessarias para que o Smart Link funcione no ambiente self-hosted.

## 1. Atualizar `scripts/deploy.sh`

Adicionar `smart-link-redirect` na lista de Edge Functions que sao copiadas para o servidor (linha 24). Atualmente a lista inclui apenas as funcoes anteriores e a nova funcao nao esta sendo deployada.

A linha atualizada ficara:

```text
for FUNC in evolution-api send-scheduled-messages admin-api backup-export generate-ai-message process-queue sync-group-stats group-events-webhook smart-link-redirect; do
```

## 2. Executar migracoes SQL no banco self-hosted

As duas migracoes criadas (tabela `campaign_smart_links` e tabela `smart_link_clicks`) precisam ser aplicadas no banco Postgres da VPS. O comando na VPS sera:

```text
sudo ./scripts/run-migrations.sh supabase/migrations <db_password>
```

Isso aplicara todas as migracoes pendentes, incluindo as duas novas tabelas com suas politicas RLS.

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `scripts/deploy.sh` | Adicionar `smart-link-redirect` na lista de funcoes (linha 24) |

Nenhum outro arquivo precisa ser alterado. Apos o deploy (`sudo ./scripts/deploy.sh`), a funcao estara disponivel e acessivel publicamente via `https://api.DOMINIO/functions/v1/smart-link-redirect?slug=SEU_SLUG`.

