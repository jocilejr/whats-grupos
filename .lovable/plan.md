

## Diagnóstico: Loop de Reconexão com Status 405

### Problema
Os logs mostram um loop infinito: `connecting → close (Status 405) → reconnect → connecting → close (405)...`

**Status 405** no Baileys significa que a sessão foi **invalidada/substituída** (o WhatsApp rejeitou as credenciais). A sessão antiga (provavelmente criada na v6) é incompatível com a v7, mas o código atual trata 405 como "reconectável" porque só para no `loggedOut` (401).

### Causa Raiz
Linha 141 do `server.js`:
```js
const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
```
`DisconnectReason.loggedOut` = 401. Como 405 ≠ 401, o servidor tenta reconectar infinitamente com credenciais inválidas, nunca gerando QR code.

### Plano de Correção

**`baileys-server/server.js`** — Duas mudanças:

1. **Tratar 405 como sessão inválida**: Quando `statusCode === 405`, limpar os arquivos de sessão e **não** reconectar automaticamente. Isso força a geração de um novo QR code na próxima vez que o usuário clicar "Reconectar".

2. **Adicionar lista de códigos não-reconectáveis**: Além de 401 (loggedOut), incluir 405 (replaced/invalid), 406, e 440 como códigos que exigem novo QR ao invés de reconexão automática.

```text
server.js (connection === 'close' handler):
  ANTES:  shouldReconnect = statusCode !== DisconnectReason.loggedOut
  DEPOIS: shouldReconnect = ![401, 405, 406, 440].includes(statusCode)
  
  Quando NÃO reconectar:
    - Limpar arquivos de sessão do disco
    - Remover da memória (sessions.delete)
    - Logar que precisa de novo QR code
```

Após o deploy, o loop para imediatamente. O usuário clica "Reconectar" na UI e recebe um QR code novo.

