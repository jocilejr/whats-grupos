

## Buscar invite links individualmente (1 por vez)

### Problema

O endpoint batch do Baileys ainda falha para 3 grupos mesmo com delay e retry. O rate limit do WhatsApp e mais agressivo do que o esperado.

### Solucao

Substituir a chamada batch por chamadas individuais ao endpoint `/group/inviteCode/:name/:jid` (que ja existe no Baileys server), com delay de 1.5s entre cada chamada e retry automatico para falhas.

### Alteracao

**Arquivo:** `supabase/functions/sync-invite-links/index.ts`

- Remover a chamada ao endpoint `inviteCodeBatch`
- Para cada grupo, chamar `GET /group/inviteCode/:name/:jid` individualmente
- Esperar 1.5 segundos entre cada chamada
- Se falhar, esperar 3 segundos e tentar novamente (1 retry)
- Logar cada sucesso/falha individualmente

### Fluxo

```text
Para cada grupo (JID):
  1. GET /group/inviteCode/:instance/:jid
  2. Se sucesso -> salvar URL
  3. Se falhou -> esperar 3s -> retry 1x
  4. Esperar 1.5s antes do proximo grupo
```

### Detalhes tecnicos

- O endpoint individual `/group/inviteCode/:name/:jid` ja existe no `baileys-server/server.js` e retorna `{ invite_url: "https://chat.whatsapp.com/..." }` ou `{ invite_url: null }`
- Nenhuma alteracao necessaria no Baileys server
- Apenas a edge function `sync-invite-links` sera modificada
- O delay de 1.5s entre chamadas garante que o WhatsApp nao aplique rate limit (total ~22s para 15 grupos, aceitavel)

