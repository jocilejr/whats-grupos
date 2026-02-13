
# Plano de Melhorias para Produção

Auditoria completa da aplicacao "Simplificando Grupos" com recomendacoes organizadas por prioridade para tornar o produto robusto, seguro e profissional.

---

## 1. Seguranca (Critico)

### 1.1 Credenciais expostas na tabela `message_queue`
A tabela `message_queue` armazena `api_url` e `api_key` da Evolution API em texto puro em cada registro. Qualquer usuario autenticado com acesso via RLS pode ver as chaves de API de outros usuarios se as policies nao estiverem restritas corretamente. A solucao e remover essas colunas da fila e buscar as credenciais diretamente na `global_config` dentro da Edge Function `process-queue`, que ja usa `SERVICE_ROLE_KEY`.

### 1.2 Habilitar protecao contra senhas vazadas
O linter do banco detectou que a protecao contra senhas vazadas (leaked password protection) esta desativada. Ativar essa funcionalidade impede que usuarios usem senhas ja comprometidas em vazamentos publicos.

### 1.3 CORS permissivo nas Edge Functions
Todas as Edge Functions usam `Access-Control-Allow-Origin: "*"`. Em producao, restringir ao dominio real da aplicacao (ex: `https://whats-grupos.lovable.app`).

### 1.4 Recuperacao de senha
Nao existe fluxo de "Esqueci minha senha". Adicionar um botao na tela de login que aciona `supabase.auth.resetPasswordForEmail()` e uma pagina para definir nova senha.

---

## 2. Estabilidade e Resiliencia

### 2.1 Tratamento global de erros (Error Boundary)
A aplicacao nao possui um Error Boundary do React. Se qualquer componente falhar, a tela inteira fica branca. Criar um componente `ErrorBoundary` que captura erros e exibe uma mensagem amigavel com opcao de recarregar.

### 2.2 Configuracao do React Query
O `QueryClient` e criado sem configuracoes. Adicionar:
- `retry: 2` para tentar novamente em caso de falha
- `staleTime` global de 30 segundos para evitar requisicoes excessivas
- `onError` global para logar erros

### 2.3 Fila de mensagens - timeout de itens "sending"
Se a Edge Function `process-queue` falhar no meio da execucao, itens ficam travados com status `sending` para sempre. Criar uma funcao no banco (trigger ou cron) que reseta itens `sending` ha mais de 5 minutos de volta para `pending`.

### 2.4 Limite de 1000 registros no Dashboard
As queries do Dashboard buscam `message_logs` dos ultimos 30 dias sem limite. Se um usuario enviar mais de 1000 mensagens, os dados ficam incompletos (limite padrao do banco). Usar `count` para metricas e/ou paginar.

---

## 3. UX e Polimento Visual

### 3.1 Loading states consistentes
Algumas paginas (Campaigns, Settings) tem loading states, outras nao. Padronizar com Skeleton loaders em todas as paginas.

### 3.2 Pagina 404 em ingles
A pagina `NotFound` esta em ingles ("Page not found"). Traduzir para portugues para manter consistencia.

### 3.3 Confirmacao antes de excluir instancia
Na pagina de Settings, o botao de excluir instancia nao tem confirmacao (AlertDialog). Adicionar para evitar exclusoes acidentais.

### 3.4 Responsividade
Verificar e ajustar a tabela da pagina Fila e a tabela de Usuarios (admin) para telas menores. Tabelas largas quebram em mobile.

### 3.5 Feedback visual no envio de mensagens
Apos enfileirar mensagens, o usuario nao tem um link direto para a pagina de Fila. Adicionar um botao/link no toast de sucesso.

---

## 4. Performance

### 4.1 Lazy loading de rotas
Todas as paginas sao importadas estaticamente no `App.tsx`. Usar `React.lazy()` + `Suspense` para carregar paginas sob demanda, reduzindo o bundle inicial.

### 4.2 Otimizar subscription realtime
A subscription da pagina Fila invalida todas as queries a cada mudanca. Em cenarios de alto volume, isso causa muitas re-renderizacoes. Usar o payload do evento para atualizar o cache local.

### 4.3 Limpeza automatica de dados antigos
Criar um cron job no banco para limpar registros antigos da `message_queue` (status `sent` ou `error` com mais de 7 dias), evitando crescimento indefinido da tabela.

---

## 5. Funcionalidades para Produto Comercial

### 5.1 Pagina de perfil do usuario
Permitir que o usuario altere seu nome de exibicao e senha. Atualmente nao existe nenhuma pagina de perfil.

### 5.2 Logs de atividade para o admin
O admin nao tem visibilidade sobre o que cada usuario esta fazendo. Adicionar uma visao de logs agregados por usuario no painel admin.

### 5.3 Notificacoes de desconexao da instancia
Quando uma instancia WhatsApp desconecta, o usuario so descobre quando tenta enviar. Implementar verificacao periodica do status e notificar via toast/badge na sidebar.

### 5.4 Termos de uso e politica de privacidade
Para um produto comercial, e necessario ter paginas de Termos de Uso e Politica de Privacidade acessiveis na tela de login.

---

## Detalhes Tecnicos de Implementacao

### Arquivos a criar:
- `src/components/ErrorBoundary.tsx` - Componente de captura de erros
- `src/pages/ResetPassword.tsx` - Pagina de redefinicao de senha
- `src/pages/Profile.tsx` - Pagina de perfil do usuario

### Arquivos a modificar:
- `src/App.tsx` - Adicionar ErrorBoundary, lazy loading, rota de perfil e reset password
- `src/pages/Auth.tsx` - Adicionar link "Esqueci minha senha"
- `src/pages/NotFound.tsx` - Traduzir para portugues
- `src/pages/QueuePage.tsx` - Otimizar realtime, responsividade
- `src/pages/SettingsPage.tsx` - Adicionar confirmacao de exclusao
- `src/pages/Messages.tsx` - Remover envio de api_key/api_url na fila
- `supabase/functions/process-queue/index.ts` - Buscar credenciais do banco ao inves de receber da fila

### Migracoes SQL:
- Criar cron job para resetar itens `sending` travados
- Criar cron job para limpeza de registros antigos da `message_queue`
- (Opcional) Remover colunas `api_url` e `api_key` da tabela `message_queue` apos migrar a logica

### Ordem de execucao recomendada:
1. Seguranca (itens 1.1 a 1.4)
2. Estabilidade (itens 2.1 a 2.4)
3. UX (itens 3.1 a 3.5)
4. Performance (itens 4.1 a 4.3)
5. Funcionalidades comerciais (itens 5.1 a 5.4)
