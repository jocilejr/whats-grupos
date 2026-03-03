

## Diagnóstico: QR Code Não Gerado no Baileys v7

### Problema Identificado

O console mostra que tanto `reconnectInstance` quanto `connectInstance` retornam `{"instance":{"state":"connecting"}}` sem QR Code. Isso significa que o Baileys v7 está demorando mais que o timeout configurado para gerar o primeiro QR.

### Causa Raiz

No `server.js`, o endpoint `/instance/create` espera apenas **3 segundos** e o `/instance/connect` espera mais **5 segundos** pelo QR. No Baileys v7, a inicialização do socket mudou e pode levar mais tempo para emitir o primeiro evento `qr` no `connection.update`.

Além disso, na reconexão:
1. Delete (ok)
2. Wait 2s
3. Create (espera 3s internamente)
4. Se não tem QR, wait 2s + connect (espera 5s)

Total: ~12s, mas se v7 demora mais, o QR nunca chega a tempo.

### Plano de Correção

**1. `baileys-server/server.js`** - Melhorar a geração de QR:

- **Aumentar timeout** no `/instance/create` de 3s para 5s
- **Aumentar timeout** no `/instance/connect` de 5s para 10s, com polling a cada 1s em vez de esperar fixo
- **Adicionar logging detalhado** nos eventos `connection.update` para debug
- **Adicionar endpoint `/instance/qrcode/:name`** dedicado que faz polling do QR com timeout configurável
- **Adicionar `process.on('uncaughtException')` e `process.on('unhandledRejection')`** para evitar crashes silenciosos

**2. `supabase/functions/evolution-api/index.ts`** - Melhorar a lógica de reconexão:

- No `reconnectInstance`, após criar, fazer polling do QR com retry (até 3 tentativas de 3s cada)
- Aumentar o delay entre delete e create de 2s para 3s
- Logar mais detalhes para debug

**3. `src/pages/SettingsPage.tsx`** - Melhorar feedback ao usuário:

- Quando `connectInstance` retorna `state: connecting` sem QR, aguardar 3s e tentar novamente automaticamente (até 2 retries)
- Mostrar mensagem "Aguardando QR Code..." durante o retry

### Mudanças Concretas

```text
server.js:
  /instance/create    → timeout 3s → 5s
  /instance/connect   → wait fixo 5s → polling 1s x 10 tentativas
  + global error handlers para evitar crash
  + logs detalhados no connection.update

evolution-api/index.ts:
  reconnectInstance   → polling QR com 3 retries de 3s
  connectInstance     → retry se retornar connecting sem QR

SettingsPage.tsx:
  showQrCode()        → retry automático 2x se não receber QR
  reconnectInstance() → retry automático 2x se não receber QR
```

