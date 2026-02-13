
## Transformacao SaaS - Simplificando Grupos

### Resumo

Transformar o sistema atual em um SaaS multi-tenant com:
- Sistema de roles (admin/user) com admin fixo (jocilejun@gmail.com)
- Admin gerencia a Evolution API globalmente (usuarios nao veem)
- Admin cria contas de usuarios com limites personalizados
- API externa para criacao automatica de contas (integracao com pagamento, etc.)
- Usuarios so veem suas instancias e QR codes
- Limites por usuario: instancias, mensagens/hora, campanhas

---

### 1. Banco de Dados - Novas tabelas e alteracoes

**Tabela `user_roles`** - Controle de permissoes

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | ID unico |
| user_id | uuid (FK auth.users) | Referencia ao usuario |
| role | app_role (enum: admin, user) | Papel do usuario |

**Tabela `user_plans`** - Limites por usuario

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | ID unico |
| user_id | uuid (FK auth.users, unique) | Referencia ao usuario |
| max_instances | integer (default: 1) | Maximo de instancias |
| max_messages_per_hour | integer (default: 100) | Mensagens por hora |
| max_campaigns | integer (default: 5) | Campanhas ativas |
| is_active | boolean (default: true) | Conta ativa/suspensa |
| created_at / updated_at | timestamptz | Datas |

**Tabela `global_config`** - Configuracao global da Evolution API (admin only)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | ID unico |
| evolution_api_url | text | URL da Evolution API |
| evolution_api_key | text | API Key global |
| created_at / updated_at | timestamptz | Datas |

**Alteracoes na tabela `api_configs`:**
- Remover colunas `api_url` e `api_key` (serao da config global)
- Manter `instance_name`, `user_id`, `max_messages_per_hour`, `is_active`
- O limite de mensagens/hora sera herdado do plano do usuario (user_plans), mas pode ser sobrescrito por instancia

**Funcao `has_role`** - Security definer para evitar recursao RLS

**RLS Policies:**
- `user_roles`: somente admin pode ler/inserir/atualizar
- `user_plans`: somente admin pode gerenciar; usuario pode ler o proprio
- `global_config`: somente admin pode ler/modificar
- `api_configs`: usuario gerencia as proprias (mantido), mas sem ver api_url/api_key

**Seed inicial:** Inserir role admin para jocilejun@gmail.com (via migration, apos o usuario existir)

---

### 2. Edge Function - API de Criacao de Contas

**`supabase/functions/admin-api/index.ts`**

Endpoints (via query param `action`):

- **`createUser`** (POST): Cria usuario no auth, profile, role=user, e plano com limites
  - Body: `{ email, password, display_name, max_instances, max_messages_per_hour, max_campaigns }`
  - Requer header `Authorization: Bearer <API_KEY>` (chave de API do admin, armazenada como secret)

- **`updatePlan`** (POST): Atualiza limites de um usuario
  - Body: `{ user_id, max_instances, max_messages_per_hour, max_campaigns, is_active }`

- **`listUsers`** (GET): Lista todos os usuarios com seus planos

- **`deleteUser`** (POST): Desativa/remove usuario

Autenticacao da API: via secret `ADMIN_API_KEY` verificado no header.

---

### 3. Edge Function - Ajuste no `evolution-api`

A edge function existente sera modificada para:
- Em vez de buscar `api_url` e `api_key` do `api_configs` do usuario, buscar da tabela `global_config`
- Manter a validacao de que o usuario e dono da instancia (`api_configs.user_id = user.id`)
- Adicionar action `createInstance` para criar instancia na Evolution API
- Adicionar action `getQRCode` para obter o QR code da instancia

---

### 4. Frontend - Contexto de Roles

**`src/hooks/useRole.ts`** - Hook que consulta `user_roles` para saber se o usuario logado e admin ou user.

**`src/contexts/AuthContext.tsx`** - Adicionar `role` e `plan` ao contexto.

---

### 5. Frontend - Painel Admin

**Nova pagina `src/pages/admin/AdminUsers.tsx`:**
- Lista de usuarios com plano, status, email
- Criar novo usuario (formulario com email, senha, nome, limites)
- Editar limites do usuario
- Ativar/desativar usuario

**Nova pagina `src/pages/admin/AdminConfig.tsx`:**
- Formulario para configurar URL e API Key da Evolution API global
- Testar conexao

**Nova pagina `src/pages/admin/AdminDashboard.tsx`:**
- Visao geral: total de usuarios, instancias ativas, mensagens enviadas

---

### 6. Frontend - Experiencia do Usuario (nao-admin)

**Pagina de Configuracoes (`SettingsPage.tsx`) - Reformulada:**
- Remove campos de API URL e API Key (o usuario NAO ve isso)
- Mostra apenas: lista de instancias do usuario
- Botao "Criar Nova Instancia" (que chama a Evolution API internamente via edge function para criar a instancia e retorna o QR code)
- Cada instancia mostra: nome, status (conectado/desconectado), botao para ver QR Code
- Limite de instancias baseado no plano (`user_plans.max_instances`)
- Exibir barra de uso: "2 de 5 instancias"

**Pagina Auth (`Auth.tsx`):**
- Remover formulario de cadastro - somente login
- Texto: "Conta criada pelo administrador"

---

### 7. Frontend - Navegacao

**`src/components/AppSidebar.tsx`:**
- Menu condicional baseado na role
- Admin ve: Dashboard Admin, Usuarios, Config Global, alem das paginas normais
- User ve: Dashboard, Enviar Mensagem, Campanhas, Templates, Historico, Backup

---

### 8. Rotas

**`src/App.tsx`:**
- Adicionar rotas `/admin`, `/admin/users`, `/admin/config`
- Proteger rotas admin com verificacao de role

---

### Detalhes tecnicos

**Arquivos novos:**
- `src/pages/admin/AdminUsers.tsx`
- `src/pages/admin/AdminConfig.tsx`
- `src/pages/admin/AdminDashboard.tsx`
- `src/hooks/useRole.ts`
- `src/components/AdminRoute.tsx` (guard de rota admin)
- `supabase/functions/admin-api/index.ts`

**Arquivos modificados:**
- `src/pages/Auth.tsx` (remover cadastro)
- `src/pages/SettingsPage.tsx` (reformular para instancias + QR code)
- `src/components/AppSidebar.tsx` (menu condicional)
- `src/App.tsx` (novas rotas admin)
- `src/contexts/AuthContext.tsx` (adicionar role/plan)
- `supabase/functions/evolution-api/index.ts` (usar config global)
- `supabase/config.toml` (nova function admin-api)

**Migracoes SQL:**
- Criar enum `app_role`
- Criar tabelas `user_roles`, `user_plans`, `global_config`
- Criar funcao `has_role`
- RLS policies para todas as novas tabelas
- Alterar `api_configs` (remover api_url/api_key, ou manter mas nao expor)

**Secret necessario:**
- `ADMIN_API_KEY` - chave para autenticar chamadas externas a API de criacao de contas

---

### Sequencia de implementacao

1. Migracoes de banco (tabelas, enum, funcao has_role, RLS, seed admin)
2. Edge function `admin-api`
3. Ajustar edge function `evolution-api` (config global + createInstance + getQRCode)
4. Hook `useRole` e contexto atualizado
5. Componente `AdminRoute`
6. Paginas admin (Users, Config, Dashboard)
7. Reformular SettingsPage (instancias + QR code)
8. Remover cadastro da Auth page
9. Atualizar sidebar e rotas
