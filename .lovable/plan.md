

## Diagnóstico: Mensagens "enviadas" mas não entregues no WhatsApp mobile

### Causa raiz identificada

Os logs do Baileys mostram exatamente o que está acontecendo:

```
[sendText] mentionsEveryOne=true, jid=120363184992222035@g.us
[sendText] Mentions added: 897 participants
[sendText] Failed to fetch group metadata for mentions: Timed Out
[sendText] Error: Connection Closed
```

**3 problemas concretos no `baileys-server/server.js`:**

1. **`mentionsEveryOne` derruba a conexão em grupos grandes** — Para mencionar todos, o servidor chama `groupMetadata()` para pegar a lista de participantes. Em grupos com 800+ membros, essa chamada faz timeout e derruba a conexão WebSocket inteira. Quando a conexão cai, `sendMessage()` falha com "Connection Closed". Porém, se o `groupMetadata` consegue retornar antes do timeout, o `sendMessage` tenta enviar uma mensagem com 897 menções — o que o WhatsApp rejeita silenciosamente no protocolo (chega no Web mas não propaga pro mobile).

2. **Código deployado usa API v6 (incompatível)** — O `server.js` atual usa `fetchLatestBaileysVersion` e `makeCacheableSignalKeyStore`, que são funções da v6. A memória do projeto indica que houve migração para v7, mas o arquivo no repositório ainda tem o código antigo. Isso causa comportamento instável.

3. **Reconexão sem backoff** — Quando a conexão cai, o servidor tenta reconectar após apenas 3 segundos, sem backoff exponencial. Isso pode causar ban temporário do WhatsApp.

### Plano de correção

#### 1. Corrigir `mentionsEveryOne` para grupos grandes

Em vez de buscar `groupMetadata()` (que faz uma query ao servidor do WhatsApp e pode timeout), usar a lista de participantes já disponível no cache local do Baileys. Se não estiver em cache, enviar SEM menções em vez de derrubar a conexão.

```text
// Antes (atual): chama API do WhatsApp
const metadata = await session.sock.groupMetadata(jid);
msgOptions.mentions = metadata.participants.map(p => p.id);

// Depois: timeout curto + fallback sem menções
const metadata = await Promise.race([
  session.sock.groupMetadata(jid),
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
]);
```

Aplicar isso em `sendText` (linha 316-323) e `sendMedia` (linha 359-366).

#### 2. Atualizar server.js para API Baileys v7

- Remover `fetchLatestBaileysVersion` e `makeCacheableSignalKeyStore`
- Usar `auth: state` diretamente (padrão v7)
- Configurar `browser: ['Mac OS', 'Desktop', '']` para evitar erro 405

#### 3. Adicionar backoff na reconexão

- Primeira tentativa: 5s, segunda: 15s, terceira: 60s
- Após 3 tentativas, parar e aguardar reconexão manual

#### 4. Limitar tamanho de menções

- Para grupos com mais de 300 participantes, não incluir menções (enviar como texto normal)
- O WhatsApp tem um limite implícito de menções por mensagem — ultrapassá-lo faz a mensagem ser entregue apenas parcialmente

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `baileys-server/server.js` | Atualizar para API v7, timeout no groupMetadata, limite de menções, backoff na reconexão |

### Observação importante

Após o deploy, será necessário **reconectar a instância por QR Code** pois a mudança de v6 para v7 invalida as sessões existentes.

