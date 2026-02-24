

# Smart Link - Rotacionador de Grupos por Campanha

## Resumo

Um sistema de "link inteligente" por campanha que distribui leads entre os grupos automaticamente. Voce cria uma URL unica para a campanha, define o limite maximo de membros por grupo, e quando alguem acessa o link, e redirecionado para o link de convite do grupo que ainda tem vaga. Quando um grupo lota, o proximo grupo da lista recebe os novos leads.

## Como vai funcionar

1. Na campanha, um novo botao "Leads" aparece quando ha grupos selecionados
2. Ao clicar, abre um dialog mostrando cada grupo com seu numero atual de membros (via API do WhatsApp)
3. Nesse dialog, voce configura:
   - O link de convite de cada grupo (ex: `https://chat.whatsapp.com/ABC123`)
   - O limite maximo de membros por grupo
   - Um slug unico para gerar a URL publica (ex: `minha-campanha`)
4. Uma URL publica e gerada (ex: `https://.../r/minha-campanha`)
5. Quando alguem acessa essa URL, uma edge function verifica o member_count dos grupos e redireciona para o primeiro grupo que ainda nao atingiu o limite

## Mudancas

### 1. Nova tabela: `campaign_smart_links`

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK para campaigns |
| user_id | uuid | Dono |
| slug | text (unique) | Identificador na URL |
| max_members_per_group | integer | Limite para rotacionar |
| group_links | jsonb | Array de `{group_id, invite_url, position}` |
| is_active | boolean | Ativo/inativo |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

RLS: usuarios gerenciam apenas os proprios registros.

### 2. Nova edge function: `smart-link-redirect`

- Rota publica (sem JWT)
- Recebe o slug como parametro
- Busca o smart link e os group_ids associados
- Consulta `group_stats` para obter o `member_count` atual de cada grupo (ultimo snapshot)
- Percorre os grupos na ordem definida (`position`)
- Redireciona (HTTP 302) para o `invite_url` do primeiro grupo que ainda nao atingiu `max_members_per_group`
- Se todos estiverem lotados, redireciona para o ultimo grupo (ou mostra mensagem)

### 3. Nova pagina publica: rota `/r/:slug`

- Rota simples no React Router (fora do ProtectedRoute)
- Mostra um loading enquanto chama a edge function
- Redireciona o usuario para o link de convite do WhatsApp

### 4. Novo componente: `CampaignLeadsDialog`

Dialog que abre ao clicar no botao "Leads" da campanha. Conteudo:

- **Tabela de grupos**: nome do grupo, membros atuais (buscado da `group_stats`), link de convite (editavel), posicao na fila
- **Configuracoes**: slug da URL, limite maximo de membros por grupo
- **URL gerada**: campo copiavel com a URL publica final
- **Botao salvar**: persiste no `campaign_smart_links`

### 5. Botao "Leads" no card da campanha

- Aparece apenas quando `c.group_ids?.length > 0`
- Icone: `BarChart3` ou `Link`
- Posicionado entre "Mensagens" e o botao de excluir

## Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela `campaign_smart_links` |
| `supabase/functions/smart-link-redirect/index.ts` | Nova edge function |
| `src/components/campaigns/CampaignLeadsDialog.tsx` | Novo componente |
| `src/pages/Campaigns.tsx` | Adicionar botao "Leads" + state para o dialog |
| `src/pages/SmartLinkRedirect.tsx` | Nova pagina publica de redirect |
| `src/App.tsx` | Adicionar rota `/r/:slug` |
| `supabase/config.toml` | `verify_jwt = false` para smart-link-redirect |

## Detalhes tecnicos

### Edge function `smart-link-redirect`

```text
GET /smart-link-redirect?slug=minha-campanha

1. Busca campaign_smart_links onde slug = parametro e is_active = true
2. Extrai group_links (array ordenado por position)
3. Para cada group_id, busca member_count mais recente em group_stats
4. Primeiro grupo com member_count < max_members_per_group -> redireciona para invite_url
5. Se todos lotados -> redireciona para o ultimo
```

### Fluxo do usuario

```text
Campanha -> Botao "Leads" -> Dialog abre
  -> Ve tabela com grupos e membros atuais
  -> Cola link de convite em cada grupo
  -> Define limite (ex: 200)
  -> Define slug (ex: "promo-2026")
  -> Salva
  -> Copia URL: https://whats-grupos.lovable.app/r/promo-2026
  -> Compartilha essa URL
  -> Pessoas acessam -> redirecionadas para grupo com vaga
```

### Fonte de dados para member_count

Os member counts vem da tabela `group_stats` (populada pela edge function `sync-group-stats` que ja roda periodicamente). A edge function de redirect usa o snapshot mais recente de cada grupo. Nao faz chamada direta a API do WhatsApp para manter a resposta rapida.

No dialog, para exibir dados atualizados, disparamos um `sync-group-stats` ao abrir e depois lemos de `group_stats`.

