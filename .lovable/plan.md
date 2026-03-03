

# Causa raiz: versão do protocolo WhatsApp obsoleta no Baileys

## O problema REAL

O erro 405 **não é causado pelo código do servidor** — é um bug conhecido da biblioteca `@whiskeysockets/baileys@7.0.0-rc.9`.

A versão do protocolo WhatsApp hardcoded no Baileys é `[2, 3000, 1027934701]`, que **o WhatsApp já não aceita mais**. Toda tentativa de conexão é rejeitada com 405 antes mesmo de gerar o QR Code. Issue confirmada: [GitHub #2376](https://github.com/WhiskeySockets/Baileys/issues/2376).

## Correção

Passar a versão correta do protocolo no `makeWASocket()` em `baileys-server/server.js`:

```javascript
const sock = makeWASocket({
  auth: state,
  logger,
  printQRInTerminal: false,
  generateHighQualityLinkPreview: true,
  version: [2, 3000, 1034074495],  // ← versão atual do WA Web
});
```

Isso é uma única linha adicionada na chamada `makeWASocket` (linha ~179 do `server.js`).

## Arquivo alterado
- `baileys-server/server.js` — adicionar `version: [2, 3000, 1034074495]` ao config do `makeWASocket`

## Após a alteração
- Rebuild do container: `docker compose up -d --build baileys-server`
- A primeira tentativa de "QR Code" deve gerar o QR normalmente

