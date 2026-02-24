

# Corrigir Contagem de Eventos por Fuso Horario

## Problema

A query `group-event-counts-today` usa `new Date().toISOString().split("T")[0]` para calcular "hoje", o que resulta na data UTC. No Brasil (UTC-3), isso significa que eventos entre meia-noite local e 03:00 UTC sao filtrados para o dia errado, causando divergencia entre o badge "3 hoje" (que usa fuso local) e o card "-2 saidas" (que usa UTC).

## Solucao

Usar meia-noite local convertida para UTC ao filtrar eventos, garantindo que a query capture todos os eventos do dia local do usuario.

## Mudanca Tecnica

### `src/pages/GroupsPage.tsx`

Substituir o filtro de data baseado em UTC por limites de dia local:

```typescript
// Antes (UTC):
const today = new Date().toISOString().split("T")[0];
// ...
.gte("created_at", `${today}T00:00:00`)
.lt("created_at", `${today}T23:59:59.999`)

// Depois (local):
const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);
const endOfToday = new Date(startOfToday);
endOfToday.setDate(endOfToday.getDate() + 1);
// ...
.gte("created_at", startOfToday.toISOString())
.lt("created_at", endOfToday.toISOString())
```

A variavel `today` (usada para `snapshot_date` do `group_stats`) permanece inalterada pois o snapshot_date e gerado em UTC pela edge function e deve ser consultado consistentemente em UTC.

Adicionar novas variaveis `startOfToday` e `endOfToday` apenas para a query de contagem de eventos.

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/GroupsPage.tsx` | Adicionar `startOfToday`/`endOfToday` com fuso local; atualizar filtro da query `group-event-counts-today` |

