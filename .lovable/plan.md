

## Diagnóstico

O problema é claro: mensagens agendadas **antes** das correções de fuso horário têm `next_run_at` calculado incorretamente. A migration anterior só corrigiu mensagens com `next_run_at` atrasado em mais de 2 horas — mas mensagens com horários "quase certos" (ex: 1h de diferença) ou ainda no futuro com offset errado não foram corrigidas.

**Não é necessário reprogramar manualmente.** A solução correta é recalcular o `next_run_at` de **todas** as mensagens ativas recorrentes.

## Plano

### 1. Migration: Recalcular next_run_at de TODAS as mensagens ativas

Executar um UPDATE em `scheduled_messages` para todas as mensagens ativas com `schedule_type != 'once'`, recalculando `next_run_at` baseado no `content->>'runTime'` e no tipo de agendamento, usando a lógica correta de timezone BRT. Remover a condição `next_run_at < now() - interval '2 hours'` para pegar todas, inclusive as que têm horário futuro mas errado.

A mesma lógica SQL da migration anterior será usada, mas sem o filtro de "stale" — aplicando a todas as mensagens ativas recorrentes.

### 2. Nenhuma mudança de código

A edge function `send-scheduled-messages` e `calculateNextRunAt` já estão corretas. O problema é apenas dados legados com `next_run_at` errado.

