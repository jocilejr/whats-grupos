

## Problema: Mensagem de amanhã disparada hoje

### Diagnóstico

A imagem mostra que na quarta-feira há apenas 1 mensagem às 21:00. A segunda mensagem às 21:00 pertence a quinta-feira, mas foi disparada hoje.

**Causa raiz**: O backlog causado pela falha de DNS. A mensagem semanal de quinta tinha `next_run_at` apontando para a quinta passada (quando o cron estava quebrado). Quando o cron voltou a funcionar hoje, `claim_due_messages` capturou essa mensagem porque a condição é simplesmente `next_run_at <= now()` — sem verificar há quanto tempo no passado o `next_run_at` está.

Ou seja: uma mensagem com `next_run_at = 2026-02-19T00:00:00Z` (quinta passada) foi claimada hoje (quarta, 26/02) porque `now()` > `next_run_at`. O sistema tratou como "vencida, precisa enviar", quando na verdade deveria ter sido **pulada e recalculada** para a próxima quinta futura.

### Solução

Duas correções complementares:

**1. Proteção contra backlog stale na função `claim_due_messages`** (migração SQL)

Adicionar uma condição que ignore mensagens com `next_run_at` mais antigo que 2 horas. Mensagens vencidas há mais de 2h são consideradas stale e devem ser recalculadas, não executadas:

```sql
CREATE OR REPLACE FUNCTION public.claim_due_messages()
  RETURNS SETOF scheduled_messages
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE scheduled_messages
  SET processing_started_at = now()
  WHERE id IN (
    SELECT sm.id
    FROM scheduled_messages sm
    WHERE sm.is_active = true
      AND sm.next_run_at <= now()
      AND sm.next_run_at > now() - interval '2 hours'  -- NEW: ignora backlog stale
      AND (sm.processing_started_at IS NULL 
           OR sm.processing_started_at < now() - interval '10 minutes')  -- aumentado de 5 para 10 min
      AND (sm.campaign_id IS NULL OR EXISTS (
        SELECT 1 FROM campaigns c WHERE c.id = sm.campaign_id AND c.is_active = true
      ))
      AND (sm.last_completed_at IS NULL OR sm.last_completed_at < sm.next_run_at)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$function$
```

**2. Adicionar auto-recuperação de mensagens stale na Edge Function `send-scheduled-messages`**

Após processar as mensagens normais, adicionar um passo que recalcula o `next_run_at` de mensagens ativas cujo `next_run_at` está mais de 2h no passado (stale), avançando-as para a próxima execução futura em vez de dispará-las:

No `handleCronTrigger`, após o loop de processamento, adicionar:

```typescript
// Auto-recover stale messages: recalculate next_run_at for messages stuck in the past
const { data: staleMessages } = await supabase
  .from("scheduled_messages")
  .select("*")
  .eq("is_active", true)
  .not("next_run_at", "is", null)
  .lt("next_run_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
  .is("processing_started_at", null);

if (staleMessages?.length) {
  for (const msg of staleMessages) {
    if (msg.schedule_type === "once") {
      // Once messages that are stale should be deactivated
      await supabase.from("scheduled_messages").update({
        is_active: false, next_run_at: null,
      }).eq("id", msg.id);
    } else {
      // Recurring messages: recalculate to next future occurrence
      const nextRunAt = calculateNextRunAt(msg, new Date());
      await supabase.from("scheduled_messages").update({
        next_run_at: nextRunAt, processing_started_at: null,
      }).eq("id", msg.id);
    }
  }
  console.log(`Auto-recovered ${staleMessages.length} stale messages`);
}
```

**3. Ação imediata na VPS** — Recalcular o backlog existente

Comando para rodar no terminal da VPS para limpar as mensagens stale agora:

```bash
docker exec $(docker ps -qf "name=supabase-db") psql -U postgres -d postgres -c "
  UPDATE scheduled_messages 
  SET next_run_at = NULL, is_active = false 
  WHERE schedule_type = 'once' 
    AND is_active = true 
    AND next_run_at < now() - interval '2 hours';
"
```

Para as recorrentes (weekly/daily), o passo 2 acima cuidará automaticamente na próxima execução do cron.

### Resumo das mudanças

| Arquivo | Alteração |
|---|---|
| Migração SQL | Atualizar `claim_due_messages`: janela de 2h para stale + timeout de 10min |
| `send-scheduled-messages/index.ts` | Adicionar auto-recuperação de mensagens stale no `handleCronTrigger` |
| VPS (manual) | Limpar mensagens `once` vencidas |

### Detalhes Técnicos

A proteção funciona em duas camadas:
- **Camada 1 (DB)**: `claim_due_messages` simplesmente ignora mensagens com `next_run_at` > 2h no passado
- **Camada 2 (Edge Function)**: Detecta essas mensagens stale e recalcula o `next_run_at` para a próxima ocorrência futura, em vez de dispará-las

Isso garante que falhas de infraestrutura (DNS, cron parado, etc.) nunca causem disparos em massa de mensagens vencidas.

