

## Corrigir URL da API saindo do container

### Problema

A URL longa de "URL de Retorno (Texto)" esta ultrapassando os limites do container porque o elemento `code` nao esta respeitando o overflow corretamente.

### Solucao

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx` (linhas 385-398)

Adicionar `overflow-hidden` ao container e garantir que o `code` tenha `overflow-hidden text-ellipsis` para truncar o texto longo corretamente:

1. No `div` container (linha 385): adicionar `overflow-hidden`
2. No elemento `code` (linha 388): adicionar `overflow-hidden` para garantir que o texto longo seja cortado

Alteracao na linha 385:
- De: `<div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 p-3">`
- Para: `<div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 p-3 overflow-hidden">`

Alteracao na linha 388:
- De: `<code className="text-sm truncate block text-foreground">`
- Para: `<code className="text-sm truncate block text-foreground overflow-hidden">`

Isso garante que a URL longa sera truncada com reticencias (...) em vez de ultrapassar o container.

