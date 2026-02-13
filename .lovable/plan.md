

# Plano de Melhorias de Design

Redesign completo para uniformizar a experiencia visual e elevar o nivel de profissionalismo da aplicacao.

---

## Diagnostico: O que esta inconsistente hoje

Algumas paginas (Dashboard, Messages, Campaigns, Templates, Settings) ja possuem o padrao premium com header estilizado (icone com gradiente + glow + subtitulo). Porem as seguintes paginas estao com design "cru" e destoam do resto:

- **QueuePage** - Header simples sem icone/gradiente, cards de metricas sem estilo premium, tabela sem responsividade
- **AdminDashboard** - Header simples, cards basicos sem gradientes
- **AdminUsers** - Header simples, tabela sem responsividade, sem empty state estilizado
- **AdminConfig** - Header simples, sem gradientes nos cards
- **BackupPage** - Header simples, cards basicos
- **Auth (Login)** - Usa icone generico (MessageSquare) em vez do logo da marca, sem gradientes
- **AppLayout** - Barra superior vazia (so tem o trigger da sidebar), sem breadcrumb ou titulo da pagina
- **Sidebar Footer** - Mostra apenas o email cortado, sem avatar ou nome do usuario

---

## Melhorias Planejadas

### 1. Padronizar Headers de Todas as Paginas
Aplicar o mesmo padrao visual premium (icone com gradiente + blur + titulo + subtitulo) nas paginas que ainda nao tem:
- QueuePage
- AdminDashboard
- AdminUsers
- AdminConfig
- BackupPage

**Arquivos:** `QueuePage.tsx`, `AdminDashboard.tsx`, `AdminUsers.tsx`, `AdminConfig.tsx`, `BackupPage.tsx`

### 2. Cards de Metricas Premium
Aplicar o mesmo estilo dos metric cards do Dashboard (borda colorida, gradiente sutil, hover com scale) nos summary cards de:
- QueuePage (Pendentes, Enviando, Enviados, Erros)
- AdminDashboard (Usuarios, Instancias, Mensagens, Campanhas)

**Arquivos:** `QueuePage.tsx`, `AdminDashboard.tsx`

### 3. Tela de Login com Identidade Visual
- Substituir o icone generico `MessageSquare` pelo logo da marca (`logo.png`)
- Adicionar gradiente sutil no fundo e glow no card
- Melhorar espacamento e tipografia

**Arquivo:** `Auth.tsx`

### 4. Breadcrumb/Titulo no Layout Principal
Adicionar o nome da pagina atual na barra superior do `AppLayout`, ao lado do `SidebarTrigger`, para dar contexto ao usuario sobre onde ele esta.

**Arquivo:** `AppLayout.tsx`

### 5. Sidebar Footer com Avatar
Melhorar o footer da sidebar com:
- Avatar com iniciais do usuario (usando componente Avatar do shadcn)
- Nome de exibicao (se disponivel) alem do email
- Melhor formatacao visual

**Arquivo:** `AppSidebar.tsx`

### 6. Responsividade nas Tabelas
Envolver as tabelas em `overflow-x-auto` para scroll horizontal em mobile:
- QueuePage
- AdminUsers

**Arquivos:** `QueuePage.tsx`, `AdminUsers.tsx`

### 7. Loading States com Skeleton
Substituir textos de "Carregando..." e spinners soltos por Skeleton loaders padronizados nas paginas:
- AdminUsers
- AdminConfig
- QueuePage (ja tem spinner, padronizar com skeleton)

**Arquivos:** `AdminUsers.tsx`, `AdminConfig.tsx`

### 8. Meta Tags e OG Image
- Atualizar a `og:image` no `index.html` para usar uma imagem propria da marca em vez da imagem padrao do Lovable
- Corrigir `lang="en"` para `lang="pt-BR"`

**Arquivo:** `index.html`

### 9. Remover App.css Residual
O arquivo `App.css` contem estilos do template Vite padrao que nao sao usados e podem causar conflitos (ex: `#root { max-width: 1280px }`).

**Arquivo:** `App.css` (limpar conteudo)

### 10. Micro-interacoes nos Cards Interativos
Adicionar `hover:scale-[1.02] transition-all duration-300` nos cards clicaveis que ainda nao tem, como os cards de Backup.

**Arquivo:** `BackupPage.tsx`

---

## Detalhes Tecnicos

### Padrao de Header Reutilizavel (referencia)
Todas as paginas devem seguir este padrao visual:
```text
+--------------------------------------------------+
| [blur glow]                                      |
|   [icone com gradiente]  Titulo da Pagina        |
|                          Subtitulo descritivo     |
+--------------------------------------------------+
```

### Arquivos a Modificar (10 arquivos)
1. `src/pages/QueuePage.tsx` - Header, cards, responsividade
2. `src/pages/admin/AdminDashboard.tsx` - Header, cards premium
3. `src/pages/admin/AdminUsers.tsx` - Header, responsividade, skeleton
4. `src/pages/admin/AdminConfig.tsx` - Header, skeleton
5. `src/pages/BackupPage.tsx` - Header, hover nos cards
6. `src/pages/Auth.tsx` - Logo, gradientes
7. `src/components/AppLayout.tsx` - Titulo da pagina no top bar
8. `src/components/AppSidebar.tsx` - Footer com avatar
9. `src/App.css` - Limpar estilos residuais
10. `index.html` - lang pt-BR, remover og:image do Lovable

### Ordem de Execucao
1. Limpar App.css e index.html (rapido, sem risco)
2. AppLayout com titulo da pagina
3. AppSidebar footer com avatar
4. Auth com logo da marca
5. Paginas admin (Dashboard, Users, Config)
6. QueuePage e BackupPage
7. Micro-interacoes e skeleton loaders

