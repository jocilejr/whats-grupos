
## Adicionar `smart-link-api` ao script de deploy

### Problema

O script `scripts/deploy.sh` copia as edge functions para o servidor VPS, mas a funcao `smart-link-api` nao esta na lista de funcoes a serem copiadas (linha 24). Por isso, a versao corrigida (com `npm:` import) nunca chega ao servidor, e o erro `InvalidWorkerCreation` persiste.

### Solucao

**Arquivo:** `scripts/deploy.sh`

Adicionar `smart-link-api` na lista de funcoes copiadas na linha 24.

De:
```text
for FUNC in evolution-api send-scheduled-messages admin-api backup-export generate-ai-message process-queue sync-group-stats group-events-webhook smart-link-redirect sync-invite-links; do
```

Para:
```text
for FUNC in evolution-api send-scheduled-messages admin-api backup-export generate-ai-message process-queue sync-group-stats group-events-webhook smart-link-redirect smart-link-api sync-invite-links; do
```

### Apos a implementacao

Voce precisara rodar no servidor VPS:
1. `git pull`
2. `sudo ./scripts/deploy.sh`

Isso copiara a versao corrigida do `smart-link-api` (com import `npm:`) para o ambiente Supabase local e reiniciara as functions.
