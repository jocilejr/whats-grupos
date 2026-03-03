

## Plano: API Externa Autônoma + Webhooks + Documentação Admin

### Conceito

A API externa será um canal **totalmente independente** da aplicação principal. Requisições externas vão direto ao Baileys Server sem passar pela `message_queue` nem registrar em `message_logs`. O integrador externo é responsável por seu próprio controle de fluxo.

### O que será feito

**1. Baileys Server (`baileys-server/server.js`)**

- Adicionar listener `messages.upsert` no `createSession()` para capturar mensagens recebidas e enviar via webhook
- O servidor consultará `webhook_configs` via REST do Supabase para saber quais URLs disparar
- Payload do webhook:
  ```text
  {
    event: "message.received",
    instanceName, from, participant, messageType,
    content, timestamp, isGroup
  }
  ```
- Também disparar webhook para `connection.update` (status da conexão mudou)

**2. Tabela `webhook_configs`**

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| user_id | uuid |
| webhook_url | text |
| events | text[] |
| is_active | boolean |
| secret | text (token de validação) |
| created_at | timestamptz |

RLS: usuários gerenciam os próprios; admins gerenciam todos.

**3. Página Admin `src/pages/admin/AdminApiDocs.tsx`**

Duas abas:

- **Endpoints**: Documentação dos endpoints do Baileys (instâncias, grupos, mensagens) com método, rota, body de exemplo e botão "Copiar cURL". Base URL preenchida via `global_config.baileys_api_url`.
- **Webhooks**: Formulário para cadastrar URLs, selecionar eventos (checkboxes), ativar/desativar, e testar envio.

**4. Rota e Navegação**

- Rota `/admin/api-docs` em `App.tsx` protegida por `AdminRoute`
- Item "API & Webhooks" no menu admin em `AppSidebar.tsx` com ícone `Code`

### Fluxo da API Externa

```text
Sistema externo (n8n, CRM, etc.)
        │
        ▼
  POST /message/sendText/:name  ──► Baileys Server ──► WhatsApp (direto)
        │
        └── Sem fila, sem logs, sem delay da aplicação

WhatsApp ──► Baileys (messages.upsert) ──► POST webhook_url (message.received)
```

### Eventos de webhook disponíveis

| Evento | Descrição |
|--------|-----------|
| `message.received` | Mensagem recebida em qualquer conversa |
| `group.participant.update` | Entrada/saída de participante (já existe) |
| `connection.update` | Status da conexão mudou |

