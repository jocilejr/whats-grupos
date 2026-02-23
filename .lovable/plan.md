# Sistema de Monitoramento de Membros dos Grupos

## O que sera construido

Um sistema completo para rastrear a quantidade de membros em cada grupo WhatsApp, com historico de entradas e saidas diarias.

## Componentes

### 1. Nova tabela no banco de dados: `group_stats`

Armazena snapshots diarios dos grupos:


| Coluna        | Tipo        | Descricao                                    |
| ------------- | ----------- | -------------------------------------------- |
| id            | uuid        | Chave primaria                               |
| user_id       | uuid        | Dono da instancia                            |
| instance_name | text        | Nome da instancia                            |
| group_id      | text        | ID do grupo WhatsApp                         |
| group_name    | text        | Nome do grupo                                |
| member_count  | integer     | Total de membros no momento                  |
| joined_today  | integer     | Quantos entraram desde o ultimo snapshot     |
| left_today    | integer     | Quantos sairam desde o ultimo snapshot       |
| snapshot_date | date        | Data do snapshot (uma entrada por grupo/dia) |
| created_at    | timestamptz | Timestamp de criacao                         |


Constraint unica em `(user_id, group_id, snapshot_date)` para garantir um registro por grupo por dia.

RLS: usuarios so acessam seus proprios dados.

### 2. Nova Edge Function: `sync-group-stats`

Fluxo:

1. Recebe `configId` do usuario (ou sincroniza todas as instancias ativas)
2. Busca a `api_configs` para obter `instance_name` e `api_url`
3. Chama `/group/fetchAllGroups/:instanceName` no Baileys server
4. Para cada grupo retornado, busca o ultimo snapshot (dia anterior) no banco
5. Calcula:
  - `joined_today` = max(0, member_count_atual - member_count_anterior)
  - `left_today` = max(0, member_count_anterior - member_count_atual)
6. Faz upsert na tabela `group_stats` para a data de hoje

Pode ser chamada manualmente pelo usuario e via cron a cada 15 minutos.

### 3. Nova pagina: `/groups` - Monitoramento de Grupos

Cards com visao geral:

- Total de grupos monitorados
- Total de membros (soma)
- Entradas hoje
- Saidas hoje

Tabela com todos os grupos:

- Nome do grupo
- Membros atuais
- Entradas hoje (badge verde)
- Saidas hoje (badge vermelho)
- Ultimo sync

Botao "Sincronizar Agora" para atualizar manualmente.

Grafico de tendencia (opcional): evolucao de membros nos ultimos 30 dias.

### 4. Navegacao

Adicionar item "Grupos" no menu lateral (`AppSidebar.tsx`) com icone `Users`.  
  
IMPORTANTE: ADICIONE TAMBÉM AO DASHBOARD PRINCIPAL TODAS AS INFORMAÇOES DOS GRUPOS

### 5. Rota

Adicionar rota `/groups` no `App.tsx`.

## Detalhes tecnicos

### Tabela SQL

```sql
CREATE TABLE public.group_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  instance_name text NOT NULL,
  group_id text NOT NULL,
  group_name text NOT NULL,
  member_count integer NOT NULL DEFAULT 0,
  joined_today integer NOT NULL DEFAULT 0,
  left_today integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id, snapshot_date)
);

ALTER TABLE public.group_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own group_stats" ON public.group_stats FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Edge Function `sync-group-stats`

- Autenticada (recebe token do usuario)
- Busca configs ativas do usuario
- Para cada instancia, chama o Baileys para obter grupos
- Compara com snapshot anterior e faz upsert
- Retorna resumo: quantos grupos sincronizados, entradas, saidas

### Pagina `GroupsPage.tsx`

- Botao de sync manual que chama a edge function
- Tabela com dados do dia atual
- Filtro por instancia (se houver mais de uma)
- Dados historicos consultaveis por data

## Arquivos a criar/modificar


| Arquivo                                        | Acao                            |
| ---------------------------------------------- | ------------------------------- |
| Migracao SQL                                   | Criar tabela `group_stats`      |
| `supabase/functions/sync-group-stats/index.ts` | Nova edge function              |
| `supabase/config.toml`                         | Registrar nova function         |
| `src/pages/GroupsPage.tsx`                     | Nova pagina                     |
| `src/App.tsx`                                  | Adicionar rota `/groups`        |
| `src/components/AppSidebar.tsx`                | Adicionar item de menu "Grupos" |
