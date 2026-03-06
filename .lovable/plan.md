

## Diagnóstico: QR Code não gerado ao reconectar

### Causa raiz

O fluxo de reconexão tem **waits insuficientes** para a migração v6→v7:

1. A edge function `reconnectInstance` chama DELETE → espera 2s → CREATE → se não tem QR, espera 2s → CONNECT
2. O endpoint `/instance/connect` espera no máximo 5s pelo QR
3. Com sessões v6 corrompidas sendo limpas, o Baileys v7 precisa de mais tempo para fazer o handshake inicial e gerar o QR
4. Resultado: a resposta volta como `{"instance":{"state":"connecting"}}` sem QR, e o frontend mostra "Erro ao reconectar"

### Plano de correção

#### 1. Melhorar o endpoint `/instance/connect/:name` no baileys-server

Substituir o wait único de 5s por um **polling loop** que verifica o QR a cada 1s por até 15s:

```javascript
// Ao invés de: await new Promise(r => setTimeout(r, 5000));
// Usar polling:
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 1000));
  if (session.qr || session.connected) break;
}
```

#### 2. Aumentar espera no `reconnectInstance` da edge function

- Aumentar wait entre delete e create de 2s para **5s** (dar tempo para limpar sessão v6)
- Aumentar wait entre create e connect de 2s para **3s**

#### 3. Adicionar limpeza forçada no endpoint `/instance/create`

Antes de criar uma sessão, limpar explicitamente arquivos de sessão antigos que podem ser incompatíveis com v7:

```javascript
// No /instance/create, antes de createSession:
const sessionDir = path.join(SESSIONS_DIR, instanceName);
if (fs.existsSync(sessionDir)) {
  fs.rmSync(sessionDir, { recursive: true, force: true });
}
```

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `baileys-server/server.js` | Polling loop no connect, limpeza forçada no create |
| `supabase/functions/evolution-api/index.ts` | Aumentar waits no reconnectInstance |

