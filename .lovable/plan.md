

# Correção: Agendamentos Duplicados e Proteção contra Duplicatas Futuras

## Problema Identificado

Para cada dia da semana no horário 14:00, existem **dois registros ativos** em `scheduled_messages`:
- Um com `campaign_id` (correto, vinculado a campanha `2f54e5e7...`)
- Um sem `campaign_id` (duplicata órfã, mesmos grupos, mesmo conteúdo)

Ambos disparam no mesmo minuto, fazendo cada grupo receber a mensagem **duas vezes**.

**Causa provável**: restauração de backup que falhou no mapeamento do `campaign_id`, gerando cópias órfãs.

---

## Plano de Correção

### 1. Limpeza dos Registros Duplicados (VPS - Manual)

Executar na VPS para desativar os registros órfãos sem campaign_id que são duplicatas:

```sql
UPDATE scheduled_messages
SET is_active = false
WHERE campaign_id IS NULL
  AND is_active = true
  AND content->>'runTime' = '14:00'
  AND schedule_type = 'weekly'
  AND instance_name = 'Rosana';
```

**Recomendação**: antes de desativar, verificar se existem duplicatas em outros horarios tambem:

```sql
SELECT content->>'runTime' as run_time,
       content->'weekDays'->0 as weekday,
       count(*) as total,
       count(campaign_id) as com_campanha,
       count(*) - count(campaign_id) as sem_campanha
FROM scheduled_messages
WHERE is_active = true
GROUP BY content->>'runTime', content->'weekDays'->0, schedule_type
HAVING count(*) > 1
ORDER BY run_time, weekday;
```

### 2. Proteção no Edge Function `send-scheduled-messages`

Adicionar deduplicacao na funcao `enqueueMessage` para evitar que itens da fila sejam criados para grupos que ja foram enfileirados recentemente (mesma campanha/horario).

**Arquivo**: `supabase/functions/send-scheduled-messages/index.ts`

Antes de inserir os `queueItems`, verificar se ja existem itens pendentes/enviando na `message_queue` para os mesmos grupos com o mesmo `scheduled_message_id` ou `campaign_id` nas ultimas 2 horas:

```typescript
// Dentro de enqueueMessage, antes do insert:
const { data: recentItems } = await supabase
  .from("message_queue")
  .select("group_id")
  .in("group_id", allGroupIds)
  .eq("instance_name", instanceName)
  .in("status", ["pending", "sending", "sent"])
  .gte("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

if (recentItems?.length) {
  const recentGroupIds = new Set(recentItems.map(i => i.group_id));
  const filteredGroupIds = allGroupIds.filter(id => !recentGroupIds.has(id));
  if (!filteredGroupIds.length) return 0;
  // usar filteredGroupIds ao inves de allGroupIds
}
```

### 3. Proteção no Backup Restore

**Arquivo**: `src/lib/backup.ts` (linha 369)

Corrigir o mapeamento de `campaign_id` para usar `null` explicitamente quando o mapeamento falha, em vez de `undefined`:

```typescript
campaign_id: newCampaignId || null,  // ja esta assim, OK
```

Adicionar verificacao de duplicatas antes de inserir: checar se ja existe um `scheduled_message` ativo com o mesmo `content->>'runTime'`, `schedule_type`, `content->'weekDays'` e mesmos `group_ids` para o mesmo usuario.

---

## Detalhes Tecnicos

### Fluxo do problema

```text
scheduled_messages (14:00, weekday [1])
  |
  +-- ID a6590b41 (campaign_id = 2f54e5e7) --> 15 grupos --> message_queue batch A
  |
  +-- ID 55b1be0d (campaign_id = NULL)      --> 15 grupos --> message_queue batch B
                                                              (mesmos grupos = DUPLICATA)
```

### Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/send-scheduled-messages/index.ts` | Adicionar deduplicacao por grupo/instancia antes do enqueue |
| `src/lib/backup.ts` | Adicionar verificacao de duplicatas no restore |

### Impacto

- Zero downtime
- Mensagens futuras protegidas contra duplicatas
- Registros orfaos desativados imediatamente via SQL na VPS
