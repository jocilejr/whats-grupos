

# Contagem de Cliques e Conversoes no Smart Link

## Resumo

Adicionar rastreamento de cliques (quantas vezes a URL foi acessada) e conversoes (quantas pessoas efetivamente entraram no grupo) ao sistema de Smart Link. Os dados serao exibidos na tabela do dialog de configuracao.

## Mudancas

### 1. Nova tabela: `smart_link_clicks`

Registra cada clique individual no smart link, incluindo qual grupo foi direcionado.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid | PK |
| smart_link_id | uuid | FK para campaign_smart_links |
| group_id | text | Grupo para o qual foi redirecionado |
| clicked_at | timestamptz | Momento do clique |
| ip_hash | text (nullable) | Hash do IP para deduplicacao (opcional) |

RLS: leitura pelo dono do smart link, insercao publica (via service role na edge function).

### 2. Contagem de conversoes (entradas no grupo)

As conversoes serao calculadas a partir da tabela `group_participant_events` ja existente. Para cada grupo do smart link, contamos os eventos de `action = 'add'` que ocorreram apos a criacao do smart link. Isso da uma estimativa de quantas pessoas entraram no grupo desde que o link foi ativado.

Nao e necessario criar tabela nova para isso -- reutilizamos dados que ja existem.

### 3. Edge function `smart-link-redirect` -- registrar clique

Ao processar um redirecionamento, a edge function insere um registro em `smart_link_clicks` com o `smart_link_id` e o `group_id` escolhido, antes de retornar a URL.

### 4. Dialog `CampaignLeadsDialog` -- exibir metricas

Adicionar duas colunas novas na tabela de grupos:

| # | Grupo | Membros | Cliques | Entradas | Link de convite |
|---|---|---|---|---|---|
| 1 | Grupo A | 150/200 | 45 | 32 | https://... |

- **Cliques**: total de registros em `smart_link_clicks` para aquele `group_id` + `smart_link_id`
- **Entradas**: total de eventos `add` em `group_participant_events` para aquele `group_id` desde a criacao do smart link

Tambem adicionar cards de resumo no topo:
- Total de cliques (todos os grupos)
- Total de entradas (todos os grupos)

## Detalhes tecnicos

### Tabela `smart_link_clicks`

```text
CREATE TABLE smart_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_link_id uuid NOT NULL REFERENCES campaign_smart_links(id) ON DELETE CASCADE,
  group_id text NOT NULL,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

-- Indice para consultas rapidas
CREATE INDEX idx_smart_link_clicks_link_group ON smart_link_clicks(smart_link_id, group_id);

-- RLS: dono do smart link pode ler
-- Insercao apenas via service role (edge function)
```

### Edge function -- trecho de registro de clique

```text
// Apos determinar o grupo de destino:
await serviceSupabase
  .from("smart_link_clicks")
  .insert({
    smart_link_id: smartLink.id,
    group_id: selectedGroupId
  });
```

### Dialog -- consulta de cliques

```text
-- Cliques por grupo
SELECT group_id, COUNT(*) as clicks
FROM smart_link_clicks
WHERE smart_link_id = :id
GROUP BY group_id

-- Entradas por grupo (desde criacao do smart link)
SELECT group_id, COUNT(*) as joins
FROM group_participant_events
WHERE group_id IN (:group_ids)
  AND action = 'add'
  AND created_at >= :smart_link_created_at
GROUP BY group_id
```

### Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela `smart_link_clicks` com RLS |
| `supabase/functions/smart-link-redirect/index.ts` | Adicionar insert de clique |
| `src/components/campaigns/CampaignLeadsDialog.tsx` | Adicionar colunas de cliques/entradas + cards de resumo |

