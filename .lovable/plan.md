

# Correção definitiva: WhatsApp rejeita Platform.WEB (405)

## Causa raiz confirmada

O WhatsApp começou a rejeitar conexões que se identificam como `Platform.WEB` (valor 14). Agora exige `Platform.MACOS` (valor 24). O Baileys `7.0.0-rc.9` usa WEB por padrão, causando 405 em toda tentativa de pairing.

**PR oficial**: [WhiskeySockets/Baileys#2365](https://github.com/WhiskeySockets/Baileys/pull/2365) -- confirmado funcionando por 10+ usuários na última semana.

## Correção

Duas alterações:

### 1. `baileys-server/package.json` -- instalar o fork com a correção
Trocar a dependência do Baileys para o branch com o fix:
```json
"@whiskeysockets/baileys": "kobie3717/Baileys#fix/405-platform-macos"
```

### 2. `baileys-server/server.js` -- configurar browser como macOS
Adicionar a opção `browser` no `makeWASocket` para garantir que a plataforma MACOS é usada:
```javascript
const sock = makeWASocket({
  auth: state,
  logger,
  printQRInTerminal: false,
  generateHighQualityLinkPreview: true,
  browser: ['Baileys', 'Chrome', '131.0.0'],
});
```
E remover o `version` hardcoded que não resolve o problema.

## Após a alteração
- Rebuild obrigatório: `docker compose up -d --build baileys-server` (o `npm install` no Dockerfile vai baixar o fork)
- Testar QR Code -- deve gerar e parear normalmente

