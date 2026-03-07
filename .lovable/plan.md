

## Correção do `calculateNextRunAt` — Backend + Frontend

### Problema confirmado

O `calculateNextRunAt` no backend (edge function) e o `computeNextRunAt` no frontend usam lógica de `dayOverflow` que causa dois bugs:

1. **Horários >= 21:00 BRT**: `brtH + 3 >= 24` gera `dayOverflow = 1`, que desloca o cálculo +2 dias e inverte o dia da semana
2. **Horários matutinos com `dayOverflow = 0`**: `setUTCHours(h + 3)` quando h >= 21 causa overflow automático do Date, incrementando o dia silenciosamente

A evidência no banco mostrou 14 registros com `next_run_at` no dia errado da semana. O `pg_stat_statements` também revelou UPDATEs manuais antigos que pioraram o cenário.

### Solução: abordagem BRT-first

Eliminar completamente `dayOverflow`. Calcular tudo em "horário BRT simulado" e converter para UTC no final.

### Arquivo 1: `supabase/functions/send-scheduled-messages/index.ts`

Reescrever a função `calculateNextRunAt` (linhas 238-289). A lógica para **todos** os schedule types passa a ser:

```javascript
function calculateNextRunAt(msg, now) {
  const content_ = msg.content;
  const BRT_OFFSET = 3;
  const [brtH, brtM] = (content_.runTime || "08:00").split(":").map(Number);
  
  // Trabalhar em "horário BRT" subtraindo o offset de now
  const brtNow = new Date(now.getTime() - BRT_OFFSET * 3600000);

  if (schedule_type === "daily") {
    const next = new Date(brtNow);
    next.setDate(next.getDate() + 1);
    next.setHours(brtH, brtM, 0, 0);
    // Converter BRT → UTC
    return new Date(next.getTime() + BRT_OFFSET * 3600000).toISOString();
  }
  
  if (schedule_type === "weekly") {
    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(brtNow);
      candidate.setDate(candidate.getDate() + i);
      candidate.setHours(brtH, brtM, 0, 0);
      if (weekDays.includes(candidate.getDay())) {
        return new Date(candidate.getTime() + BRT_OFFSET * 3600000).toISOString();
      }
    }
  }
  
  // monthly e custom: mesma abordagem
}
```

A chave é que `.getDay()` retorna o dia da semana correto porque estamos operando em timestamps BRT.

### Arquivo 2: `src/components/campaigns/ScheduledMessageForm.tsx`

Reescrever `computeNextRunAt` (linhas 212-258) com a mesma abordagem BRT-first:

```javascript
const computeNextRunAt = () => {
  if (scheduleType === "once") { /* sem mudança */ }
  
  const now = new Date();
  const [h, m] = runTime.split(":").map(Number);
  const BRT_OFFSET = 3;
  const brtNow = new Date(now.getTime() - BRT_OFFSET * 3600000);
  
  if (scheduleType === "weekly") {
    for (let i = 0; i < 7; i++) {
      const c = new Date(brtNow);
      c.setDate(c.getDate() + i);
      c.setHours(h, m, 0, 0);
      const utc = new Date(c.getTime() + BRT_OFFSET * 3600000);
      if (weekDays.includes(c.getDay()) && utc > now) return utc.toISOString();
    }
    // fallback +7 dias
  }
  // daily, monthly, custom: mesma abordagem
};
```

### Arquivo 3: `claim_due_messages` (banco)

Adicionar filtro `next_run_at > now() - interval '2 hours'` que já existe na VPS mas falta no codebase. Isso evita que mensagens com `next_run_at` muito antigos sejam reclamadas.

**Migração SQL:**
```sql
CREATE OR REPLACE FUNCTION public.claim_due_messages()
RETURNS SETOF scheduled_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE scheduled_messages SET processing_started_at = now()
  WHERE id IN (
    SELECT sm.id FROM scheduled_messages sm
    WHERE sm.is_active = true
      AND sm.next_run_at <= now()
      AND sm.next_run_at > now() - interval '2 hours'
      AND (sm.processing_started_at IS NULL 
           OR sm.processing_started_at < now() - interval '10 minutes')
      AND (sm.campaign_id IS NULL OR EXISTS (
        SELECT 1 FROM campaigns c WHERE c.id = sm.campaign_id AND c.is_active = true
      ))
      AND (sm.last_completed_at IS NULL OR sm.last_completed_at < sm.next_run_at)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
```

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `supabase/functions/send-scheduled-messages/index.ts` | Reescrever `calculateNextRunAt` com BRT-first |
| `src/components/campaigns/ScheduledMessageForm.tsx` | Reescrever `computeNextRunAt` com BRT-first |
| Migração SQL | Atualizar `claim_due_messages` com filtro de 2h |

### Após deploy no Lovable

Na VPS:
1. `git pull` + `deploy.sh`
2. Rodar o SQL de correção dos `next_run_at` existentes (já executado)
3. Verificar com query de validação (já executado, 0 erros)

