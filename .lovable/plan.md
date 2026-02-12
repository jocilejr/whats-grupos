

# 📱 WhatsApp Group Automation — Plano Completo

## Visão Geral
Sistema web para envio automático de mensagens para grupos do WhatsApp via Evolution API, com agendamento recorrente, suporte a todos os tipos de mensagem e autenticação de usuários.

---

## 🔐 1. Autenticação e Controle de Acesso
- Tela de **login/cadastro** com email e senha
- Área protegida — apenas usuários autenticados acessam o painel
- Perfil básico do usuário (nome, email)

## ⚙️ 2. Configuração da Evolution API
- Tela de **configurações** onde o usuário insere a URL da Evolution API e a API Key
- Dados armazenados de forma segura no backend (Supabase secrets/banco)
- Teste de conexão — botão para verificar se a API está acessível
- Suporte a múltiplas **instâncias** da Evolution API

## 📋 3. Gerenciamento de Grupos
- **Listar grupos** conectados à instância do WhatsApp
- Busca e filtro de grupos por nome
- Selecionar grupos favoritos para acesso rápido
- Visualizar detalhes do grupo (nome, participantes, foto)

## ✉️ 4. Criação e Envio de Mensagens
- Editor de mensagens com suporte a:
  - **Texto** (com formatação do WhatsApp: negrito, itálico, etc.)
  - **Imagens e mídia** (upload de fotos, vídeos, documentos)
  - **Mensagens com botões e listas** (interativas)
  - **Áudio e localização**
- **Envio imediato** para um ou múltiplos grupos simultaneamente
- Pré-visualização da mensagem antes do envio

## 📅 5. Agendamento e Automação
- **Agendar envio** para data e horário específico
- **Mensagens recorrentes** — configurar frequência:
  - Diário, semanal, mensal, ou personalizado (cron)
- Painel de **agendamentos ativos** com opção de pausar, editar ou cancelar
- Fila de envio com controle de intervalo entre mensagens (evitar bloqueio)

## 📝 6. Templates de Mensagens
- Criar e salvar **modelos de mensagens** reutilizáveis
- Organizar templates por **categorias/tags**
- Variáveis dinâmicas nos templates (ex: {{data}}, {{nome_grupo}})

## 📊 7. Histórico e Relatórios
- **Log completo** de todas as mensagens enviadas
- Status de cada envio (enviado, falha, pendente)
- Filtros por grupo, data, tipo de mensagem
- Estatísticas resumidas no **dashboard** (total enviados, falhas, agendados)

## 🏠 8. Dashboard Principal
- Visão geral com **cards** de resumo:
  - Mensagens enviadas hoje/semana/mês
  - Próximos agendamentos
  - Grupos conectados
  - Status da conexão com a API
- Atalhos rápidos para enviar mensagem e criar agendamento

---

## 🛠️ Infraestrutura
- **Backend**: Lovable Cloud (Supabase) para banco de dados, autenticação e Edge Functions
- **Edge Functions** para se comunicar com a Evolution API de forma segura (sem expor chaves no frontend)
- **Cron jobs** (pg_cron) para disparar mensagens agendadas/recorrentes
- Banco de dados para armazenar: mensagens, agendamentos, templates, histórico de envios

## 🎨 Design
- Interface limpa e moderna com sidebar de navegação
- Totalmente responsivo para uso em desktop e mobile
- Tema claro com possibilidade de tema escuro

