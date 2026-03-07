

## Plano: Simplificar toda a lógica de scheduling

### Problema raiz

A lógica atual faz malabarismos com offsets BRT manualmente, criando um "fake BRT date" e depois convertendo de volta. Isso é frágil e já quebrou várias vezes. A solução é **eliminar toda essa complexidade**.

### Princípio simples

> Usuário diz "09:00" → isso é 09:00 BRT → armazene `12:00 UTC` no `next_run_at`. Fim.

A conversão é **sempre** `hora_brt + 3 = hora_utc`. Nenhum `brtNow`, nenhum offset manual, nenhum `getDay()` vs `getUTCDay()`.

### Mudanças

#### 1. Frontend — `computeNextRunAt` em `ScheduledMessageForm.tsx`

Reescrever usando apenas `Date.UTC()`:

```
// "once": Date.UTC(ano, mes, dia, h+3, m)
// "daily": hoje ou amanhã às h+3 UTC
// "weekly": próximo dia da semana que bate, às h+3 UTC
// "monthly": dia X deste ou próximo mês, às h+3 UTC
// "custom": próximo dia custom deste ou próximo mês, às h+3 UTC
```

Sem `new Date()` local, sem `brtNow`, sem `getTime() - offset`. Tudo via `Date.UTC()`.

#### 2. Backend — `calculateNextRunAt` em `send-scheduled-messages/index.ts`

Mesma simplificação. Reescrever a função inteira:

```
// Pega "now" em UTC, converte para componentes BRT para saber "que dia/hora é em BRT"
// Calcula próximo disparo em componentes BRT
// Converte para UTC com Date.UTC(ano, mes, dia, h+3, m)
```

Sem variável `brtNow`, sem somar/subtrair offsets em milissegundos. Apenas aritmética simples com `Date.UTC`.

#### 3. SQL — Recalcular mensagens stale no banco

Executar migration para corrigir todas as mensagens ativas com `next_run_at` no passado, recalculando para o próximo disparo correto baseado no `schedule_type` e `content->>'runTime'`.

### Arquivos alterados

- `src/components/campaigns/ScheduledMessageForm.tsx` — função `computeNextRunAt`
- `supabase/functions/send-scheduled-messages/index.ts` — função `calculateNextRunAt`
- Migration SQL para recalcular mensagens stale

### Detalhes técnicos

A função helper usada em ambos os lados:

```text
brtToUtc(year, month, day, brtHour, brtMinute):
  return new Date(Date.UTC(year, month, day, brtHour + 3, brtMinute)).toISOString()
```

Para saber "agora em BRT" (necessário para decidir se o horário de hoje já passou):

```text
nowBrt = new Date(Date.now() - 3*3600000)  // só para extrair componentes
brtYear  = nowBrt.getUTCFullYear()
brtMonth = nowBrt.getUTCMonth()
brtDay   = nowBrt.getUTCDate()
brtDow   = nowBrt.getUTCDay()
```

Isso é seguro porque `getUTC*` retorna sempre o mesmo valor independente do timezone do servidor.

