

# Monitoramento de Grupos: Tempo Real e Interface Profissional

## Problema Identificado

1. **Eventos nao estao sendo registrados** -- A tabela `group_participant_events` esta vazia, indicando que o webhook do Baileys nao esta conseguindo enviar os eventos para a Edge Function (possivelmente problema de conectividade na VPS ou variaveis de ambiente faltando no container)
2. **UI usa polling de 30s** -- Mesmo quando os eventos chegam, o frontend so atualiza a cada 30 segundos
3. **Interface pode ser mais profissional** -- Falta feedback visual de tempo real, animacoes de entrada e indicadores de status de conexao

## Solucao em 3 Partes

### Parte 1: Diagnostico e Correcao do Webhook

Adicionar logs detalhados na Edge Function `group-events-webhook` para diagnosticar falhas. Tambem verificar se o Baileys Server esta enviando os eventos corretamente.

**Acoes:**
- Adicionar log de depuracao na Edge Function para rastrear requisicoes recebidas
- Verificar se a RLS policy `Service role can insert events` esta funcionando (policy atual usa `true` no WITH CHECK mas e RESTRICTIVE -- isso pode bloquear insercoes via service role)
- Corrigir a policy para PERMISSIVE se necessario

### Parte 2: Ativar Supabase Realtime

Habilitar realtime na tabela `group_participant_events` e atualizar o componente `RecentEventsSection` para usar WebSockets com fallback de polling.

**Acoes:**
- Migration SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE public.group_participant_events;`
- Reescrever `RecentEventsSection` para usar `supabase.channel()` com subscription em `postgres_changes`
- Manter polling como fallback com backoff exponencial (2s -> 30s)
- Adicionar indicador visual de "ao vivo" (bolinha verde pulsante) quando conectado via realtime

### Parte 3: Interface Profissional Redesenhada

**RecentEventsSection melhorado:**
- Animacao de entrada suave para novos eventos (slide-in)
- Indicador "LIVE" com dot pulsante verde no header
- Contador de eventos em tempo real
- Separacao visual por periodo (Agora, Ultima hora, Hoje)
- Som/notificacao opcional para novos eventos
- Scroll automatico para o topo quando novo evento chega

**GroupSummaryCards melhorado:**
- Animacao de contagem incremental nos numeros
- Indicador de variacao em tempo real (seta up/down com delta)
- Glow effect sutil quando o valor muda

**Pagina GroupsPage:**
- Badge de status de conexao realtime (Conectado/Reconectando)
- Botao de sincronizacao com feedback visual melhorado
- Filtro de tipo de evento (Entradas, Saidas, Todos)

---

## Detalhes Tecnicos

### Migration SQL
```sql
-- Habilitar realtime para eventos de grupo
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_participant_events;
```

### Correcao da RLS Policy
A policy `Service role can insert events` e do tipo RESTRICTIVE. O service role key bypassa RLS por padrao no Supabase, entao isso nao deve ser problema. Porem, vou verificar se ha outro bloqueio.

### Arquivos Modificados
1. `supabase/functions/group-events-webhook/index.ts` -- Adicionar logs de depuracao
2. `src/components/groups/RecentEventsSection.tsx` -- Reescrever com Realtime + UI profissional
3. `src/components/groups/GroupSummaryCards.tsx` -- Animacoes e indicadores de variacao
4. `src/pages/GroupsPage.tsx` -- Filtros de evento, status de conexao, layout melhorado

### Fluxo de Dados Atualizado

```text
Baileys Server (evento capturado)
       |
       v
group-events-webhook (Edge Function)
       |
       v
group_participant_events (tabela)
       |
       +---> Supabase Realtime (WebSocket push)
       |            |
       |            v
       |     RecentEventsSection (atualiza UI instantaneamente)
       |
       +---> sync-group-stats (consolida dados diarios)
                    |
                    v
              group_stats (snapshots diarios)
                    |
                    v
              GroupSummaryCards + Chart
```

