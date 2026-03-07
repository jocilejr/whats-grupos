

## Correcao do Bug de Timezone em `calculateNextRunAt`

### Problema
Quando `runTime` BRT >= 21:00, a conversao para UTC cruza a meia-noite (ex: 21:30 BRT = 00:30 UTC do dia seguinte). O codigo atual faz `setUTCHours(h_, m_)` onde `h_` pode ser >= 24, o que avanca o dia UTC automaticamente. Depois compara `candidate.getUTCDay()` contra `weekDays`, mas o dia UTC ja avancou 1 -- resultando em disparo 1 dia antes em BRT.

### Correcao

**Arquivo**: `supabase/functions/send-scheduled-messages/index.ts`, funcao `calculateNextRunAt` (linhas 238-289)

Mudancas:

1. **Sempre calcular a partir de `runTime` BRT** -- remover o bloco que extrai horas do `next_run_at` anterior (linhas 247-256), pois acumula o problema
2. **Calcular `dayOverflow`** quando `utcH >= 24` e compensar na comparacao de dias da semana
3. **Aplicar em todos os blocos**: weekly, daily, monthly, custom

Nova logica da funcao:

```typescript
function calculateNextRunAt(msg: any, now: Date): string | null {
  const content_ = msg.content as any;
  const BRT_OFFSET = 3;

  // Sempre usar runTime (BRT) como fonte de verdade
  const [brtH, brtM] = (content_.runTime || "08:00").split(":").map(Number);
  const utcH = brtH + BRT_OFFSET;
  const dayOverflow = utcH >= 24 ? 1 : 0;
  const finalUtcH = utcH % 24;

  if (msg.schedule_type === "daily") {
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + 1 + dayOverflow);
    next.setUTCHours(finalUtcH, brtM, 0, 0);
    // Se com dayOverflow o horario ja passou, nao precisa ajustar pois e +1 dia minimo
    return next.toISOString();
  } else if (msg.schedule_type === "weekly") {
    const weekDays: number[] = content_.weekDays || [1];
    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(now);
      candidate.setUTCDate(candidate.getUTCDate() + i + dayOverflow);
      candidate.setUTCHours(finalUtcH, brtM, 0, 0);
      // O dia BRT real e o dia UTC menos o dayOverflow
      const brtDay = (candidate.getUTCDay() - dayOverflow + 7) % 7;
      if (weekDays.includes(brtDay)) {
        return candidate.toISOString();
      }
    }
  } else if (msg.schedule_type === "monthly") {
    const monthDay = content_.monthDay || 1;
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth() + 1, 
      monthDay + dayOverflow, finalUtcH, brtM, 0
    ));
    return next.toISOString();
  } else if (msg.schedule_type === "custom") {
    const customDays: number[] = (content_.customDays || []).sort((a, b) => a - b);
    if (!customDays.length) return null;
    for (const day of customDays) {
      const candidate = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), 
        day + dayOverflow, finalUtcH, brtM, 0
      ));
      if (candidate > now) return candidate.toISOString();
    }
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth() + 1, 
      customDays[0] + dayOverflow, finalUtcH, brtM, 0
    ));
    return next.toISOString();
  }

  return null;
}
```

### Pos-deploy: Corrigir dados existentes (VPS)

Apos o deploy, rodar na VPS para recalcular os `next_run_at` errados:

```sql
UPDATE scheduled_messages
SET next_run_at = next_run_at + interval '1 day'
WHERE is_active = true
  AND schedule_type IN ('weekly', 'custom')
  AND (content->>'runTime')::time >= '21:00'::time
  AND next_run_at IS NOT NULL;
```

