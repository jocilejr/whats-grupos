

## Problema

A migration anterior usou `AT TIME ZONE 'America/Sao_Paulo'` para converter horários. No Postgres da VPS, essa função está **subtraindo** 3h em vez de **somar**, causando um erro de 6 horas:

- Usuário configurou: **19:30 BRT**
- Deveria gravar: **22:30 UTC** (19:30 + 3h)
- Gravou: **16:30 UTC** (19:30 - 3h = 13:30 BRT)

## Solução

Criar uma nova migration que recalcula `next_run_at` usando **aritmética explícita de intervalo** — sem nenhum uso de `AT TIME ZONE`.

### Regras de conversão

- Hora atual em BRT: `now() - interval '3 hours'`
- BRT → UTC: `+ interval '3 hours'`

### SQL da migration (1 arquivo novo)

**DAILY:**
```sql
UPDATE scheduled_messages
SET next_run_at = CASE
  WHEN (CURRENT_DATE + (COALESCE(content->>'runTime','08:00') || ':00')::interval 
        + interval '3 hours') > now()
  THEN CURRENT_DATE + (COALESCE(content->>'runTime','08:00') || ':00')::interval 
       + interval '3 hours'
  ELSE CURRENT_DATE + interval '1 day' 
       + (COALESCE(content->>'runTime','08:00') || ':00')::interval 
       + interval '3 hours'
END, processing_started_at = NULL
WHERE is_active = true AND schedule_type = 'daily';
```

**WEEKLY:** Gera próximos 14 dias com `generate_series`, filtra pelo array `weekDays`, calcula `dia + runTime + 3h`, pega o primeiro futuro.

**MONTHLY:** Usa `monthDay` no mês atual ou próximo, `+ runTime + 3h`.

**CUSTOM:** Usa array `customDays`, mesma lógica do monthly para cada dia candidato.

### Alterações

- **1 arquivo novo**: `supabase/migrations/[timestamp]_fix_timezone_arithmetic.sql`
- **Nenhuma** alteração em frontend ou edge functions (a função `calculateNextRunAt` no edge function já usa `brtH + 3` corretamente)

### Após implementar

Rodar na VPS:
```bash
source /opt/whats-grupos/.credentials
./scripts/run-migrations.sh supabase/migrations "$DB_PASSWORD"
```

