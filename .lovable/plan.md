
# Filtrar Eventos Recentes pelos Grupos Selecionados

## Problema

O componente `RecentEventsSection` mostra eventos de **todos** os grupos da instancia, ignorando a selecao feita pelo usuario em "Gerenciar Grupos". Na screenshot, aparecem eventos de grupos como "Os 7 dias do Milagre de Sao Bento #1" e "#2", que nao estao na lista de grupos monitorados.

## Solucao

Passar os `selectedGroupIds` para o `RecentEventsSection` e filtrar os eventos exibidos (e o contador "hoje") apenas pelos grupos selecionados.

## Mudancas Tecnicas

### 1. `RecentEventsSection.tsx` - Receber e aplicar filtro de grupos

- Adicionar `selectedGroupIds: Set<string>` na interface `RecentEventsSectionProps`
- Filtrar a query de eventos (`group-events-recent`) na queryFn, ou filtrar client-side os resultados
- Filtrar tambem no handler de Realtime (ignorar eventos de grupos nao selecionados)
- Atualizar `filteredEvents` e `todayCount` para respeitar o filtro

Abordagem: filtro client-side, pois a query ja retorna no maximo 100 eventos e o filtro por grupo nao e suportado nativamente pelo RLS (a tabela nao tem user_id). Isso mantem a logica simples.

```typescript
// Na interface
interface RecentEventsSectionProps {
  instanceFilter: string;
  selectedGroupIds: Set<string>;
  onRealtimeEvent?: (action: string) => void;
}

// No filtro de eventos (linha ~117)
const filteredEvents = (events ?? []).filter((e: any) => {
  if (selectedGroupIds.size > 0 && !selectedGroupIds.has(e.group_id)) return false;
  if (eventFilter === "all") return true;
  return e.action === eventFilter;
});

// No todayCount (linha ~122)
const todayCount = (events ?? []).filter((e: any) => {
  if (selectedGroupIds.size > 0 && !selectedGroupIds.has(e.group_id)) return false;
  const eventDate = new Date(e.created_at).toDateString();
  return eventDate === new Date().toDateString();
}).length;

// No handler Realtime (linha ~62), adicionar:
if (selectedGroupIds.size > 0 && !selectedGroupIds.has(newEvent.group_id)) return;
```

### 2. `GroupsPage.tsx` - Passar selectedGroupIds ao componente

```typescript
<RecentEventsSection
  instanceFilter={instanceFilter}
  selectedGroupIds={selectedGroupIds}
  onRealtimeEvent={() => { ... }}
/>
```

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/groups/RecentEventsSection.tsx` | Adicionar prop `selectedGroupIds`, filtrar eventos e Realtime |
| `src/pages/GroupsPage.tsx` | Passar `selectedGroupIds` ao componente |
