

# Unificar Contagem de Eventos por Fuso Horario

## Problema Raiz

Existem 3 fontes de dados com fusos diferentes:

| Componente | Fonte | Fuso |
|---|---|---|
| Cards de resumo | `group_participant_events` (query direta) | Local (corrigido) |
| Tabela de grupos | `group_stats.joined_today` / `left_today` | UTC (edge function) |
| Feed + badge "hoje" | `group_participant_events` (JS `toDateString`) | Local |

A tabela mostra valores diferentes dos cards porque le de `group_stats` (pre-agregado em UTC pela edge function), enquanto os cards contam diretamente da `group_participant_events` com limites de dia local.

## Solucao

Fazer a tabela de grupos tambem derivar entradas/saidas diretamente da `group_participant_events` (mesma fonte dos cards), eliminando a dependencia dos contadores pre-agregados da `group_stats` para exibicao.

## Mudancas Tecnicas

### `src/pages/GroupsPage.tsx`

1. **Expandir a query `group-event-counts-today`** para retornar contagens **por grupo** (nao so o total). Ao inves de acumular `joined`/`left` globais, construir um mapa `{ [group_id]: { joined, left } }`.

2. **Na tabela**, substituir `stat.joined_today` e `stat.left_today` pelos valores do mapa de eventos por grupo.

Detalhes da mudanca na query (linhas 119-145):

```typescript
// Antes: retorna { joined, left } totais
// Depois: retorna { totals: { joined, left }, byGroup: Record<string, { joined, left }> }

const { data: eventCounts } = useQuery({
  queryKey: ["group-event-counts-today", ...],
  queryFn: async () => {
    let query = supabase
      .from("group_participant_events")
      .select("action, group_id")
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", endOfToday.toISOString());

    if (instanceFilter !== "all") {
      query = query.eq("instance_name", instanceFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    let joined = 0, left = 0;
    const byGroup: Record<string, { joined: number; left: number }> = {};

    for (const ev of data ?? []) {
      if (selectedGroupIds.size > 0 && !selectedGroupIds.has(ev.group_id)) continue;
      if (ev.action === "add") joined++;
      else if (ev.action === "remove") left++;

      if (!byGroup[ev.group_id]) byGroup[ev.group_id] = { joined: 0, left: 0 };
      if (ev.action === "add") byGroup[ev.group_id].joined++;
      else if (ev.action === "remove") byGroup[ev.group_id].left++;
    }

    return { joined, left, byGroup };
  },
  ...
});
```

Na tabela (linhas 360-376), substituir:
```typescript
// Antes:
stat.joined_today
stat.left_today

// Depois:
eventCounts?.byGroup?.[stat.group_id]?.joined ?? 0
eventCounts?.byGroup?.[stat.group_id]?.left ?? 0
```

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/GroupsPage.tsx` | Expandir query de eventos para retornar contagens por grupo; atualizar tabela para usar esses valores |

### O que NAO muda

- A edge function `sync-group-stats` continua gravando `joined_today`/`left_today` em UTC na `group_stats` (usada para historico de 30 dias no grafico).
- Os cards de resumo continuam funcionando como antes (mesma fonte).
- O feed de eventos nao e alterado.

