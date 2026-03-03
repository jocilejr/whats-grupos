

## Problema real identificado

O 405 não é um problema de retry storm -- é um problema **arquitetural**. O Baileys Server faz coisas demais automaticamente:

1. **`restoreSessions()` no startup** reconecta TODAS as sessões simultaneamente. Cada uma recebe 405, e o WhatsApp bloqueia o IP.
2. **`/instance/create` abre WebSocket imediatamente** -- deveria apenas registrar a instância.
3. **`reconnectInstance`** faz delete → create (que conecta) → connect = 2+ conexões em sequência.

O resultado: o IP do servidor fica bloqueado pelo WhatsApp antes mesmo de você conseguir escanear um QR Code.

## Correção estrutural (2 arquivos)

### 1. `baileys-server/server.js`

- **Remover `restoreSessions()` do startup** -- não reconectar automaticamente. Instâncias só conectam quando o usuário pedir.
- **Separar create de connect**: `/instance/create` apenas cria o diretório de sessão e retorna `{ status: 'created' }`, sem abrir WebSocket.
- **Só `/instance/connect/:name` abre WebSocket** e gera QR Code.
- **Aumentar cooldown para 60s** e adicionar **backoff global** (máximo 1 conexão por vez no servidor inteiro, com 5s entre conexões diferentes).

### 2. `supabase/functions/evolution-api/index.ts`

- **`reconnectInstance`**: delete → esperar 5s → connect (não create+connect). Sem retry.
- **`createInstance`**: apenas chama `/instance/create` (que agora não conecta). Sem polling de QR.
- **Remover retry do `connectInstance`** -- uma única chamada, sem "single retry after 3s".

### Fluxo corrigido

```text
Antes:
  Startup → restoreSessions() → 5 sockets simultâneos → 5x 405 → IP bloqueado
  Criar instância → abre socket → 405 → session_expired

Depois:
  Startup → nada (só inicia o Express)
  Criar instância → registra nome → retorna OK
  Conectar instância → abre 1 socket → gera QR ou 405 com cooldown 60s
  Reconectar → delete + wait 5s + connect (1 socket)
```

### Detalhes técnicos

**`server.js` - create sem conectar:**
```javascript
app.post('/instance/create', async (req, res) => {
  const { instanceName } = req.body;
  // Apenas cria o diretório, NÃO abre WebSocket
  const sessionDir = path.join(SESSIONS_DIR, instanceName);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  res.json({ instance: { instanceName, status: 'created' } });
});
```

**`server.js` - mutex global (1 conexão por vez):**
```javascript
let globalConnectLock = null;
// Antes de cada createSession, aguarda lock global + 5s entre conexões
```

**Edge function - reconnect simplificado:**
```javascript
case "reconnectInstance":
  await fetch(`${apiUrl}/instance/delete/${instanceName}`, ...);
  await new Promise(r => setTimeout(r, 5000));
  // Vai direto para connect, sem create intermediário
  const resp = await fetch(`${apiUrl}/instance/connect/${instanceName}`, ...);
  result = await resp.json();
  break;
```

