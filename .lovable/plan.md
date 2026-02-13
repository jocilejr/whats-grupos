
## Elaborar a Pagina "Enviar Mensagem"

Transformar a pagina placeholder em uma ferramenta completa para envio imediato de mensagens para grupos do WhatsApp.

### O que o usuario vera

1. **Seletor de Instancia** - Dropdown para escolher qual instancia da Evolution API usar (das configuradas em Settings)
2. **Seletor de Grupos** - Reutiliza o componente GroupSelector existente para escolher os grupos destinatarios
3. **Tipo de Mensagem** - Grid com os 11 tipos suportados (texto, imagem, video, audio, documento, figurinha, localizacao, contato, enquete, lista)
4. **Formulario de Conteudo** - Campos dinamicos conforme o tipo selecionado (mesmo padrao do ScheduledMessageForm)
5. **Opcoes extras** - Mencionar todos, preview de link (para texto)
6. **Botao Enviar** - Dispara o envio imediato via edge function para todos os grupos selecionados, com feedback de progresso

### Fluxo de envio

- O usuario seleciona instancia, grupos, tipo de mensagem e preenche o conteudo
- Ao clicar "Enviar", a pagina chama a edge function `evolution-api` com a action correspondente (sendText, sendMedia, etc.) para cada grupo selecionado
- Exibe progresso em tempo real (ex: "Enviando 2/5 grupos...")
- Cada envio respeita o delay de 10 segundos entre grupos (consistente com o sistema de fila)
- Registra cada envio na tabela `message_logs` para historico
- Exibe toast de sucesso/erro ao finalizar

### Detalhes tecnicos

**Arquivo modificado:** `src/pages/Messages.tsx`

**Componentes reutilizados:**
- `GroupSelector` - selecao de grupos
- Mesmos campos de formulario do `ScheduledMessageForm` (texto, media, localizacao, contato, enquete, lista)

**Logica de envio:**
- Busca `api_configs` do usuario para popular o seletor de instancia
- Constroi o payload conforme o tipo de mensagem (mesmo `buildContent` do ScheduledMessageForm)
- Envia sequencialmente para cada grupo com intervalo de 10s usando `setTimeout`
- Grava em `message_logs` com status "sent" ou "error"

**Estrutura da pagina:**
```text
+----------------------------------+
| Enviar Mensagem                  |
| Envie mensagens para grupos      |
+----------------------------------+
| Instancia: [Dropdown]            |
+----------------------------------+
| Grupos: [GroupSelector]          |
+----------------------------------+
| Tipo: [Grid 10 tipos]           |
+----------------------------------+
| [Campos do tipo selecionado]    |
| [ ] Mencionar todos             |
+----------------------------------+
| [Enviar Mensagem]   progresso   |
+----------------------------------+
```

**Nenhuma migracao de banco necessaria** - usa as tabelas `api_configs` e `message_logs` existentes.
