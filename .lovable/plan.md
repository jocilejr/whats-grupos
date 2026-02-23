
# Corrigir Menções em Mídias e Link Preview no Baileys

## Problemas Identificados

### 1. Menções em imagem/vídeo não funcionam
No `baileys-server/server.js`, o endpoint `/message/sendMedia` (linha 297-324) **não lê nem usa** o campo `mentionsEveryOne` do body. Ele só extrai `number, mediatype, media, caption, fileName`. Mesmo que o `process-queue` envie `mentionsEveryOne: true` no payload, o Baileys Server ignora completamente.

### 2. Link Preview não funciona
O Baileys precisa do pacote `link-preview-js` para gerar previews de links. Apesar de `generateHighQualityLinkPreview: true` estar configurado no socket, o pacote necessário não está nas dependências do projeto (`baileys-server/package.json`). Sem ele, o Baileys não consegue buscar os metadados da URL.

## Solução

### Arquivo: `baileys-server/server.js`

**Endpoint `sendMedia` (linhas 296-324)** - Adicionar suporte a menções:

```javascript
app.post('/message/sendMedia/:name', async (req, res) => {
  try {
    const session = await getSession(req.params.name);
    if (!session || !session.connected) {
      return res.status(400).json({ error: 'Instance not connected' });
    }

    const { number, mediatype, media, caption, fileName, mentionsEveryOne } = req.body;
    const jid = number.includes('@') ? number : `${number}@g.us`;

    let msgContent;
    if (mediatype === 'image') {
      msgContent = { image: { url: media }, caption: caption || '' };
    } else if (mediatype === 'video') {
      msgContent = { video: { url: media }, caption: caption || '' };
    } else if (mediatype === 'document') {
      msgContent = { document: { url: media }, fileName: fileName || 'file', caption: caption || '' };
    } else {
      return res.status(400).json({ error: `Unsupported media type: ${mediatype}` });
    }

    // Adicionar menções se solicitado
    if (mentionsEveryOne) {
      try {
        const metadata = await session.sock.groupMetadata(jid);
        msgContent.mentions = metadata.participants.map(p => p.id);
      } catch (_) {}
    }

    const result = await session.sock.sendMessage(jid, msgContent);
    res.json({ key: result.key, status: 'PENDING' });
  } catch (e) {
    console.error('[sendMedia]', e);
    res.status(500).json({ error: e.message });
  }
});
```

### Arquivo: `baileys-server/package.json`

Adicionar dependência `link-preview-js` para que o Baileys consiga gerar previews de links:

```json
"dependencies": {
    "@whiskeysockets/baileys": "^6.7.16",
    "express": "^4.21.2",
    "qrcode": "^1.5.4",
    "pino": "^9.6.0",
    "link-preview-js": "^3.0.5"
}
```

### Apos o deploy

Na VPS, depois do `git pull`, rodar:

```bash
cd /opt/whats-grupos/baileys-server
npm install
docker compose restart baileys-server
```

Ou se estiver usando Docker build:

```bash
docker compose build baileys-server && docker compose up -d baileys-server
```

### Resultado esperado

- Imagens e videos enviados com "Mencionar todos" vao mencionar todos os participantes do grupo
- Mensagens de texto com links vao gerar preview automaticamente
