
# Plano de Melhorias para Produção

Auditoria completa da aplicacao "Simplificando Grupos" com recomendacoes organizadas por prioridade para tornar o produto robusto, seguro e profissional.

---

## 1. Seguranca (Critico)

### ✅ 1.1 Credenciais expostas na tabela `message_queue`
CONCLUÍDO - process-queue agora busca credenciais de api_configs/global_config. Messages.tsx e send-scheduled-messages inserem placeholders.

### 1.2 Habilitar protecao contra senhas vazadas
Requer ativação manual no dashboard do Supabase (Auth > Settings > Leaked Password Protection).

### 1.3 CORS permissivo nas Edge Functions
Pendente - restringir ao domínio de produção.

### ✅ 1.4 Recuperacao de senha
CONCLUÍDO - Botão "Esqueci minha senha" no login + página /reset-password.

---

## 2. Estabilidade e Resiliencia

### ✅ 2.1 Tratamento global de erros (Error Boundary)
CONCLUÍDO - ErrorBoundary.tsx criado e aplicado no App.tsx.

### ✅ 2.2 Configuracao do React Query
CONCLUÍDO - retry: 2, staleTime: 30s, refetchOnWindowFocus: false.

### ✅ 2.3 Fila de mensagens - timeout de itens "sending"
CONCLUÍDO - Cron job a cada 2 minutos reseta itens travados.

### 2.4 Limite de 1000 registros no Dashboard
Pendente - usar count para métricas.

---

## 3. UX e Polimento Visual

### 3.1 Loading states consistentes
Pendente.

### ✅ 3.2 Pagina 404 em portugues
CONCLUÍDO.

### ✅ 3.3 Confirmacao antes de excluir instancia
CONCLUÍDO - AlertDialog adicionado.

### 3.4 Responsividade
Pendente.

### 3.5 Feedback visual no envio de mensagens
Pendente.

---

## 4. Performance

### ✅ 4.1 Lazy loading de rotas
CONCLUÍDO - React.lazy + Suspense em todas as rotas.

### 4.2 Otimizar subscription realtime
Pendente.

### ✅ 4.3 Limpeza automatica de dados antigos
CONCLUÍDO - Cron job diário às 3h limpa itens com mais de 7 dias.

---

## 5. Funcionalidades para Produto Comercial

### 5.1 Pagina de perfil do usuario
Pendente.

### 5.2 Logs de atividade para o admin
Pendente.

### 5.3 Notificacoes de desconexao da instancia
Pendente.

### 5.4 Termos de uso e politica de privacidade
Pendente.
