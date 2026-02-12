
# Plano: Reestruturar Navegacao, Adicionar Status e Sistema de Campanhas

## Resumo

Remover a aba "Grupos", criar uma pagina de "Status" para monitorar instancias conectadas, e transformar "Agendamentos" em um sistema completo de **Campanhas** -- onde cada campanha agrupa grupos-alvo, mensagens agendadas e um controle de ativacao.

---

## 1. Remover a aba "Grupos"

- Remover a entrada "Grupos" do menu lateral (`AppSidebar.tsx`)
- Remover a rota `/groups` do `App.tsx`
- Remover o arquivo `src/pages/Groups.tsx`
- Remover o import de `Groups` no `App.tsx`

---

## 2. Nova pagina: Status das Instancias

Criar a pagina `/status` que mostra todas as instancias configuradas com seu estado de conexao em tempo real.

**Funcionalidades:**
- Lista todas as instancias do usuario (tabela `api_configs`)
- Para cada instancia, faz uma chamada a edge function (`action=connectionState`) para verificar o status
- Exibe badges visuais: "Conectado" (verde), "Desconectado" (vermelho), "Verificando..." (loading)
- Botao "Reconectar" que chama `action=connectInstance`
- Botao "Atualizar Tudo" para verificar todas de uma vez

**Menu lateral atualizado:**
- Dashboard
- Status (nova, com icone de atividade/sinal)
- Enviar Mensagem
- Campanhas (substitui Agendamentos)
- Templates
- Historico
- Configuracoes

---

## 3. Sistema de Campanhas (substitui Agendamentos)

### Conceito

Uma **Campanha** e um container que agrupa:
- **Grupos-alvo**: quais grupos de WhatsApp receberao as mensagens
- **Mensagens agendadas**: uma ou mais mensagens com horarios programados
- **Status ativo/inativo**: so dispara mensagens quando a campanha estiver ativa

Isso permite criar, por exemplo, uma campanha "Promocao Black Friday" com 5 grupos e 3 mensagens em horarios diferentes, e ligar/desligar tudo com um unico switch.

### Mudancas no banco de dados

**Nova tabela: `campaigns`**
| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | Identificador |
| user_id | uuid | Dono da campanha |
| api_config_id | uuid | Instancia da API |
| name | text | Nome da campanha |
| description | text | Descricao opcional |
| group_ids | text[] | IDs dos grupos selecionados |
| is_active | boolean | Liga/desliga a campanha |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Atualizacao |

**Alteracao na tabela `scheduled_messages`:**
- Adicionar coluna `campaign_id` (uuid, nullable, FK para campaigns)
- Remover `group_ids` desta tabela (os grupos ficam na campanha)

**RLS:** Politica padrao `auth.uid() = user_id` para a tabela campaigns.

### Interface da pagina de Campanhas (`/campaigns`)

**Tela principal:**
- Lista de campanhas em cards com: nome, descricao, quantidade de grupos, quantidade de mensagens agendadas, status (switch ativo/inativo)
- Botao "Nova Campanha"

**Criar/Editar Campanha (dialog ou pagina dedicada):**
1. **Dados basicos**: nome e descricao
2. **Selecionar instancia**: dropdown das instancias configuradas
3. **Selecionar grupos**: busca grupos via edge function e permite selecionar multiplos com checkboxes
4. **Mensagens da campanha**: listar mensagens agendadas desta campanha, com botao para adicionar nova mensagem
5. **Cada mensagem**: tipo (texto/imagem/documento), conteudo, data/hora ou recorrencia (once, daily, weekly, monthly, cron)
6. **Switch geral**: ativar/desativar campanha

---

## 4. Detalhes Tecnicos

### Arquivos a criar:
- `src/pages/StatusPage.tsx` -- monitoramento de instancias
- `src/pages/Campaigns.tsx` -- listagem de campanhas
- `src/components/campaigns/CampaignDialog.tsx` -- dialog de criacao/edicao
- `src/components/campaigns/GroupSelector.tsx` -- componente de selecao de grupos
- `src/components/campaigns/CampaignMessageList.tsx` -- mensagens dentro da campanha

### Arquivos a modificar:
- `src/components/AppSidebar.tsx` -- atualizar menu
- `src/App.tsx` -- atualizar rotas
- `supabase/functions/evolution-api/index.ts` -- sem mudancas necessarias (ja suporta fetchGroups e connectionState)

### Arquivos a remover:
- `src/pages/Groups.tsx`
- `src/pages/Schedules.tsx`

### Migracao SQL:
- Criar tabela `campaigns` com RLS
- Adicionar `campaign_id` a `scheduled_messages`
- Trigger de `updated_at` na tabela `campaigns`
