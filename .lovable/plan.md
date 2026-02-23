

# Corrigir deduplicacao que bloqueia mensagens diferentes para os mesmos grupos

## Problema identificado

A funcao `enqueueMessage` no `send-scheduled-messages` possui um filtro de deduplicacao que verifica se um grupo ja foi enfileirado nas ultimas 2 horas para a mesma instancia. Porem, ele nao considera o `scheduled_message_id`, fazendo com que mensagens **diferentes** agendadas para os mesmos grupos dentro de uma janela de 2 horas sejam incorretamente bloqueadas.

**Exemplo real**: A mensagem das 18:01 BRT (`3b0e9d65`) enviou para 15 grupos. Quando a mensagem das 19:30 BRT (`019311af`) tentou disparar (1h29min depois), a deduplicacao filtrou todos os 15 grupos, retornando 0.

## Solucao

Adicionar o filtro `.eq("scheduled_message_id", msg.id)` na query de deduplicacao. Assim, a verificacao so impede duplicatas da **mesma** mensagem agendada, permitindo que mensagens diferentes enviem para os mesmos grupos normalmente.

## Alteracao tecnica

**Arquivo**: `supabase/functions/send-scheduled-messages/index.ts`

Na funcao `enqueueMessage`, alterar a query de deduplicacao (linhas ~194-200):

Antes:
```typescript
const { data: recentItems } = await supabase
  .from("message_queue")
  .select("group_id")
  .in("group_id", allGroupIds)
  .eq("instance_name", instanceName)
  .in("status", ["pending", "sending", "sent"])
  .gte("created_at", twoHoursAgo);
```

Depois:
```typescript
const { data: recentItems } = await supabase
  .from("message_queue")
  .select("group_id")
  .eq("scheduled_message_id", msg.id)
  .in("group_id", allGroupIds)
  .eq("instance_name", instanceName)
  .in("status", ["pending", "sending", "sent"])
  .gte("created_at", twoHoursAgo);
```

Essa unica linha adicionada (`.eq("scheduled_message_id", msg.id)`) garante que a deduplicacao so se aplica a mesma mensagem agendada, resolvendo o problema sem remover a protecao contra duplicatas reais.

## Apos deploy

Executar na VPS:
```bash
cd /opt/whats-grupos && git pull && sudo ./scripts/deploy.sh
```

A mensagem das 19:30 voltara a funcionar normalmente no proximo dia (segunda-feira).

