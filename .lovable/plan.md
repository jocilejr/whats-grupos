

# Redesign: Grupos como Tela Principal com Selecao Persistente e Auto-Refresh

## Resumo

Eliminar a pagina Dashboard atual e transformar a pagina de Grupos em `/` (rota principal). Os grupos monitorados serao selecionaveis e persistidos no banco de dados, com atualizacao automatica a cada 30 segundos e eventos em tempo real via WebSocket. O layout sera reorganizado em duas colunas para melhor visualizacao.

---

## O que muda para o usuario

1. Ao fazer login, a primeira tela sera o **Monitoramento de Grupos** com os grupos ja selecionados previamente
2. Nao precisa mais clicar "Sincronizar Agora" toda vez -- a pagina carrega e atualiza sozinha
3. Um botao "Gerenciar Grupos" abre um dialog onde voce marca quais grupos quer acompanhar
4. Os grupos selecionados ficam salvos entre sessoes
5. As metricas (membros, entradas, saidas) atualizam a cada 30 segundos automaticamente
6. O item "Dashboard" some do menu lateral

---

## Secao Tecnica

### 1. Banco de dados

Nova tabela `user_selected_groups` para persistir selecao:

```sql
CREATE TABLE public.user_selected_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  group_id text NOT NULL,
  group_name text,
  instance_name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, group_id)
);

ALTER TABLE public.user_selected_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own selected groups"
  ON public.user_selected_groups
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. Rotas e navegacao

| Antes | Depois |
|-------|--------|
| `/` -> Dashboard | `/` -> GroupsPage (renomeado visualmente para "Monitoramento") |
| `/groups` -> GroupsPage | Rota `/groups` removida |
| Menu: Dashboard, ..., Grupos | Menu: Monitoramento, Enviar Mensagem, Campanhas, ... |

**Arquivos alterados:**
- `src/App.tsx` -- remover import do Dashboard, colocar GroupsPage em `/`, remover rota `/groups`
- `src/components/AppSidebar.tsx` -- remover item Dashboard, renomear "Grupos" para "Monitoramento" com path `/`
- `src/components/AppLayout.tsx` -- atualizar `pageTitles`: `/` -> "Monitoramento de Grupos"

### 3. Pagina GroupsPage redesenhada

**Arquivo:** `src/pages/GroupsPage.tsx` (reescrita completa)

**Layout em 2 colunas (desktop):**

```text
+-------------------------------------------+---------------------------+
| Barra superior: Titulo + Seletor +        |                           |
| Botao "Gerenciar Grupos" + LIVE badge     |                           |
+-------------------------------------------+                           |
| Cards de metricas (4 cards em grade)      |                           |
| - Grupos Monitorados                      | Eventos Recentes (LIVE)   |
| - Total de Membros                        | - Feed em tempo real      |
| - Entradas Hoje                           | - Filtros: Todos/Entradas |
| - Saidas Hoje                             |   /Saidas                 |
+-------------------------------------------+                           |
| Tabela dos Grupos Selecionados            |                           |
| - Nome | Membros | Entradas | Saidas      |                           |
| - Auto-refresh 30s                        |                           |
+-------------------------------------------+---------------------------+
| Grafico de Evolucao (30 dias)                                         |
+-----------------------------------------------------------------------+
```

**Comportamento:**
- Ao carregar, busca `user_selected_groups` e filtra `group_stats` apenas pelos grupos selecionados
- Se nao houver dados de hoje, dispara `sync-group-stats` automaticamente em background (1 vez)
- `refetchInterval: 30000` em todas as queries de metricas
- Realtime via WebSocket para eventos (ja existente)
- Se nenhum grupo selecionado, exibe estado vazio convidando a abrir o dialog

### 4. Novos componentes

**`src/components/groups/GroupSelectionDialog.tsx`**
- Dialog modal com lista de todos os grupos disponiveis (de `group_stats` hoje)
- Checkboxes para selecionar/deselecionar
- Campo de busca por nome
- Botoes "Selecionar Todos" / "Limpar"
- Ao confirmar, faz upsert/delete na tabela `user_selected_groups`

**`src/hooks/useSelectedGroups.ts`**
- Hook customizado para:
  - Buscar grupos selecionados do banco (`user_selected_groups`)
  - Adicionar/remover grupos (mutations)
  - Substituir todos os grupos selecionados de uma vez

### 5. Arquivos removidos

- `src/pages/Dashboard.tsx` -- deletado (conteudo nao sera reaproveitado)

### 6. Auto-sync na primeira carga

Na GroupsPage, ao montar:
1. Buscar `group_stats` de hoje
2. Se resultado vazio, invocar `sync-group-stats` em background
3. Apos sync, invalidar queries para exibir dados

Isso elimina a necessidade de clicar "Sincronizar Agora" manualmente. O botao permanece disponivel para sync manual sob demanda.

### 7. Componentes mantidos (com ajustes menores)

- `src/components/groups/GroupSummaryCards.tsx` -- sem alteracao
- `src/components/groups/RecentEventsSection.tsx` -- sem alteracao estrutural, apenas posicionado na coluna direita

