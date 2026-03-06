

## Diagnóstico: Erro 405 é um problema conhecido do Baileys v7 com WhatsApp

### Causa raiz real
O WhatsApp está rejeitando **todas** as conexões (novas e antigas) porque a versão do protocolo e/ou a identificação do browser estão incorretas. Isso é um bug documentado no Baileys v7 rc9 (GitHub Issue #2370). A config `browser: ['Mac OS', 'Desktop', '']` não funciona mais.

### Evidência
- Instância "Rosana" → erro 405
- Instância nova "Teste" → mesmo erro 405
- Não é sessão corrompida — é **rejeição do WhatsApp** antes de gerar QR

### Correção confirmada pela comunidade

**`baileys-server/server.js`** — Alterar `createSession()` (linha 73-79):

```javascript
// DE:
const sock = makeWASocket({
  auth: state,
  logger,
  browser: ['Mac OS', 'Desktop', ''],
  printQRInTerminal: false,
  generateHighQualityLinkPreview: true,
});

// PARA:
const sock = makeWASocket({
  auth: state,
  logger,
  browser: ['WhatsGrupos', 'Chrome', '145.0.0'],
  version: [2, 3000, 1033893291],
  printQRInTerminal: false,
  generateHighQualityLinkPreview: true,
});
```

Duas mudanças:
1. **`browser`**: Simular Chrome real em vez de "Mac OS Desktop" (que WhatsApp agora bloqueia)
2. **`version`**: Fixar versão do protocolo WhatsApp que funciona com v7 rc9

### Após implementar
Na VPS, executar:
```bash
cd /opt/whats-grupos && git pull
docker compose -f docker-compose.frontend.yml build --no-cache baileys-server
docker compose -f docker-compose.frontend.yml up -d baileys-server
docker exec baileys-server rm -rf /data/baileys-sessions/*
docker restart baileys-server
```

