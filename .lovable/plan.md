

# Correcao do Envio de Mensagens + Selecao em Massa

## Problema Identificado

Existem **6 mensagens presas no status "sending"** que nunca completam. O que acontece:

1. A funcao `process-queue` roda a cada minuto e reclama um item da fila (status "pending" -> "sending")
2. Ao fazer o `fetch` para a Evolution API, a chamada **trava indefinidamente** (a API nao responde)
3. A edge function atinge o timeout de 60s e encerra sem atualizar o status do item
4. O item fica preso como "sending" para sempre
5. Novas execucoes da fila encontram "No more pending items" porque os itens pendentes ja foram reclamados e travados

A funcao `reset_stuck_queue_items` so reseta itens com mais de 5 minutos, mas o problema se repete ciclicamente.

## Solucao

### Passo 1: Adicionar timeout no fetch da Evolution API (process-queue)

Adicionar um `AbortController` com timeout de **25 segundos** em todas as chamadas `fetch` dentro da funcao `process-queue`. Se a API nao responder em 25s, o item sera marcado como "error" com mensagem clara, em vez de ficar preso.

```text
Antes:  fetch(endpoint, { method: "POST", headers, body })
Depois: fetch(endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(25000) })
```

### Passo 2: Resetar itens travados agora

Executar SQL para desbloquear os 6 itens presos em "sending":

```sql
UPDATE message_queue 
SET status = 'pending', started_at = NULL 
WHERE status = 'sending' 
AND started_at < now() - interval '2 minutes';
```

### Passo 3: Selecao em massa na pagina de Fila

Adicionar ao `QueuePage.tsx`:

- **Checkbox em cada linha com erro** para selecionar individualmente
- **Checkbox "Selecionar todos"** no header que seleciona/deseleciona todos os itens com erro visiveis
- **Botao "Reenviar X selecionados"** que aparece quando ha itens selecionados
- A funcao `handleBulkRetry` insere novos registros na `message_queue` com status "pending" para cada item selecionado
- Selecao limpa automaticamente apos reenvio ou mudanca de filtro

## Detalhes Tecnicos

### Arquivo: `supabase/functions/process-queue/index.ts`

Modificacoes:
- Adicionar `AbortSignal.timeout(25000)` ao `fetch` dentro de `buildMessagePayload` area
- No bloco `catch`, tratar `AbortError` / `TimeoutError` com mensagem especifica

### Arquivo: `src/pages/QueuePage.tsx`

Modificacoes:
- Novo estado: `selectedIds: Set<string>`
- Nova coluna de checkbox na tabela (visivel apenas para itens com status "error")
- Checkbox "selecionar todos os erros" no header
- Botao de acao em massa ao lado dos botoes existentes
- Funcao `handleBulkRetry` com a mesma logica do `handleRetry` mas em lote
- Limpeza automatica da selecao ao mudar filtro

### Migracao SQL

Reset dos itens travados em "sending".

