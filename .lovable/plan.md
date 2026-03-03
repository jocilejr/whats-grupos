

# Diagnóstico: Race condition entre disconnect e polling

## Problema identificado no código atual

Analisando o `server.js` linhas 216-244 e 391-406:

Quando `/instance/connect/:name` é chamado:
1. `_doCreateSession` cria o socket e adiciona à Map `sessions` (linha 331)
2. O polling começa (linhas 392-401), verificando `session.qr` a cada 1s por 15s
3. O WhatsApp responde com disconnect 405 **antes** do QR chegar
4. O handler `connection.update` (linha 238) faz `sessions.delete(instanceName)` — remove da Map
5. O polling detecta `!sessions.has(name)` (linha 395) e retorna `session_expired`

O QR nunca chega ao frontend porque a sessão é removida da Map durante o polling.

## Correção

No `connection.update`, em vez de deletar a sessão do Map imediatamente no disconnect terminal, **marcar a sessão com o erro** e mantê-la no Map. O polling pode então detectar o erro específico e retornar uma resposta adequada com `retryAfter`.

### `baileys-server/server.js` - 2 alterações:

**A. No handler de disconnect terminal (linhas 232-244)**: Em vez de `sessions.delete(instanceName)`, setar `session.error = { code: statusCode }` e manter na Map. Agendar cleanup após 30s para não acumular lixo.

**B. No polling do `/instance/connect` (linhas 392-406)**: Checar `session.error` além de `sessions.has(name)`. Se `session.error`, retornar o código real do erro (405, 401, etc.) com `retryAfter` do cooldown, em vez do genérico `session_expired`.

```text
Antes:
  Socket criado → 405 chega → sessions.delete() → polling: "session_expired" (genérico)
  
Depois:
  Socket criado → 405 chega → session.error = {code: 405} → polling: {error: "terminal_405", retryAfter: 10}
  → cleanup agendado após 30s
```

### Arquivo alterado
- `baileys-server/server.js`

