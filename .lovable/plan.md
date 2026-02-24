

## Corrigir busca de invite links falhando para 5 grupos

### Diagnostico

O endpoint `inviteCodeBatch` no Baileys server chama `groupInviteCode()` para cada grupo sequencialmente sem nenhum delay. O WhatsApp aplica rate limit apos muitas chamadas seguidas, fazendo as ultimas falharem silenciosamente. Com 15 grupos, as primeiras 10 passam e as 5 finais sao bloqueadas.

Alem disso, o erro especifico de cada grupo nao e retornado ao frontend -- o toast so mostra "Links: 15" mas nao diz quais falharam nem por que.

### Solucao

#### 1. Adicionar delay entre chamadas no Baileys server

**Arquivo:** `baileys-server/server.js` (endpoint `inviteCodeBatch`)

- Adicionar um `await sleep(500)` entre cada chamada a `groupInviteCode()` para evitar rate limit do WhatsApp
- Retornar o motivo do erro para cada grupo que falhar no JSON de resposta (campo `errors`)
- Adicionar retry automatico (1 tentativa extra com delay de 2s) para grupos que falharem na primeira tentativa

```javascript
// Antes (sem delay):
for (const jid of jids) {
  const code = await session.sock.groupInviteCode(jid);
  result[jid] = `https://chat.whatsapp.com/${code}`;
}

// Depois (com delay + retry):
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const errors = {};
for (const jid of jids) {
  try {
    const code = await session.sock.groupInviteCode(jid);
    result[jid] = `https://chat.whatsapp.com/${code}`;
  } catch (err) {
    errors[jid] = err.message;
    result[jid] = null;
  }
  await sleep(500);
}
// Retry failed ones
const failedJids = Object.keys(errors);
if (failedJids.length > 0) {
  await sleep(2000);
  for (const jid of failedJids) {
    try {
      const code = await session.sock.groupInviteCode(jid);
      result[jid] = `https://chat.whatsapp.com/${code}`;
      delete errors[jid];
    } catch (err) {
      errors[jid] = err.message;
    }
    await sleep(500);
  }
}
res.json({ results: result, errors });
```

#### 2. Atualizar sync-invite-links para o novo formato de resposta

**Arquivo:** `supabase/functions/sync-invite-links/index.ts`

- Adaptar o parsing para aceitar tanto o formato antigo `{ jid: url }` quanto o novo `{ results: { jid: url }, errors: { jid: msg } }`
- Incluir os erros por grupo no response final da edge function

#### 3. Mostrar grupos com falha e motivo no toast

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx`

- Quando o sync retornar `failed_groups`, mostrar quantos falharam no toast
- Exemplo: "Links: 15 (5 falharam) | Stats: 24 grupos"

### Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `baileys-server/server.js` | Delay de 500ms entre chamadas, retry automatico, retornar erros por grupo |
| `supabase/functions/sync-invite-links/index.ts` | Adaptar parsing para novo formato com retry errors |
| `src/components/campaigns/CampaignLeadsDialog.tsx` | Mostrar quantidade de falhas no toast |

### Nota importante

Apos o deploy na VPS, voce precisara rebuildar o container do Baileys:
```bash
cd /opt/whats-grupos
docker compose build baileys-server
docker service update --force whats-grupos_baileys-server
```

