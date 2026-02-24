

## Indicador de progresso por grupo durante o sync

### Problema
Ao clicar "Sincronizar URLs agora", o usuario nao sabe qual grupo esta sendo processado. Quer ver em tempo real: "Buscando...", "Link atualizado", "Falhou" para cada grupo na tabela.

### Solucao

Mudar a logica de sync no frontend para chamar a edge function **1 grupo por vez**, atualizando o estado visual de cada linha da tabela em tempo real.

### Alteracoes

#### 1. Edge function `sync-invite-links` -- aceitar grupo unico

**Arquivo:** `supabase/functions/sync-invite-links/index.ts`

- Aceitar campo opcional `group_id` no body do POST
- Quando presente, sincronizar apenas esse grupo (sem loop, sem delay)
- Retornar resultado individual: `{ success, group_id, invite_url, error }`
- Manter comportamento atual (todos os grupos) quando `group_id` nao for enviado

#### 2. Frontend -- sync sequencial com status por grupo

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx`

- Adicionar estado `syncStatus`: `Record<string, "syncing" | "success" | "error">`
- No `handleSyncUrls`, iterar por cada `groupId` da campanha:
  1. Setar `syncStatus[groupId] = "syncing"` (mostra spinner + "Buscando...")
  2. Chamar `POST sync-invite-links` com `{ group_id: groupId }` na VPS
  3. Se sucesso e tem URL: setar `"success"` (mostra check verde + "Atualizado")
  4. Se falhou: setar `"error"` (mostra X + "Falhou")
  5. Esperar 500ms antes do proximo grupo
- Na coluna "Status do Link", durante o sync, mostrar o estado em vez do badge estatico:
  - `syncing`: Loader2 animado + "Buscando..."
  - `success`: Check verde + "Atualizado"  
  - `error`: X vermelho + "Falhou"
- Apos 5 segundos do fim, limpar `syncStatus` e voltar aos badges normais
- Chamar `sync-group-stats` em paralelo no inicio (nao precisa ser sequencial)
- Invalidar queries ao final

#### Fluxo visual na tabela durante sync

```text
#  | Grupo                  | Status do Link
1  | Comunidade #13         | [check] Atualizado
2  | Comunidade #6          | [check] Atualizado  
3  | Comunidade #11         | [spinner] Buscando...
4  | Comunidade #2          | (aguardando)
...
14 | Comunidade #8          | (aguardando)
15 | Comunidade #5          | (aguardando)
```

### Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/sync-invite-links/index.ts` | Aceitar `group_id` opcional para sync individual |
| `src/components/campaigns/CampaignLeadsDialog.tsx` | Loop sequencial com `syncStatus` por grupo na UI |

