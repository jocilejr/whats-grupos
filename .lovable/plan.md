
# Corrigir Contagem Inconsistente de Saidas nos Cards

## Problema

Os cards de metricas ("Entradas Hoje" e "Saidas Hoje") usam os valores `joined_today` e `left_today` da tabela `group_stats`, que sao atualizados pela sincronizacao periodica e pelo webhook. Ja o feed de eventos recentes lista diretamente da tabela `group_participant_events`. Essas duas fontes podem ficar fora de sincronia: se um grupo nao tem linha no `group_stats` para hoje, o webhook nao consegue incrementar o contador, mas o evento aparece normalmente no feed.

Resultado: o feed mostra 5 saidas, mas o card mostra apenas 4.

## Solucao

Derivar os contadores de entradas/saidas **diretamente da tabela `group_participant_events`** (a fonte de verdade), em vez de depender dos campos `joined_today`/`left_today` do `group_stats`.

## Mudancas Tecnicas

### 1. Nova query em `GroupsPage.tsx`

Adicionar uma query dedicada que conta eventos de hoje agrupados por acao (`add`/`remove`) diretamente da tabela `group_participant_events`:

```typescript
const { data: eventCounts } = useQuery({
  queryKey: ["group-event-counts-today", user?.id, today, instanceFilter],
  queryFn: async () => {
    let query = supabase
      .from("group_participant_events")
      .select("action, group_id")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59.999`);

    if (instanceFilter !== "all") {
      query = query.eq("instance_name", instanceFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    let joined = 0, left = 0;
    for (const ev of data ?? []) {
      if (selectedGroupIds.size > 0 && !selectedGroupIds.has(ev.group_id)) continue;
      if (ev.action === "add") joined++;
      else if (ev.action === "remove") left++;
    }
    return { joined, left };
  },
  enabled: !!user,
  refetchInterval: 30000,
});
```

### 2. Atualizar os valores passados ao `GroupSummaryCards`

Substituir `totalJoined` e `totalLeft` (que vinham de `group_stats`) pelos valores da nova query:

```typescript
const totalJoined = eventCounts?.joined ?? 0;
const totalLeft = eventCounts?.left ?? 0;
```

### 3. Invalidar a nova query no Realtime

No callback `onRealtimeEvent` do `RecentEventsSection`, adicionar invalidacao da nova query:

```typescript
onRealtimeEvent={() => {
  queryClient.invalidateQueries({ queryKey: ["group-stats-today"] });
  queryClient.invalidateQueries({ queryKey: ["group-event-counts-today"] });
}}
```

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/GroupsPage.tsx` | Nova query para contar eventos de hoje; substituir `totalJoined`/`totalLeft` pelos novos valores; invalidar nova query no Realtime |

### Resultado

Os cards de "Entradas Hoje" e "Saidas Hoje" vao sempre mostrar o mesmo numero que o feed de eventos, pois ambos usarao a mesma fonte de dados (`group_participant_events`). Sem risco de divergencia entre fontes.
