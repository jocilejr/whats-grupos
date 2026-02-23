

# Corrigir Menções em Mídias - Adicionar Logs de Debug

## Problema
A menção em imagens/videos não funciona apesar do codigo estar correto. O `catch` vazio no `groupMetadata` pode estar engolindo erros silenciosamente, impossibilitando o diagnostico.

## Solucao

### Arquivo: `baileys-server/server.js`

Adicionar logs no endpoint `sendMedia` para rastrear o fluxo completo:

```javascript
// Dentro do endpoint sendMedia, apos construir msgContent:

console.log(`[sendMedia] mentionsEveryOne=${mentionsEveryOne}, jid=${jid}, mediatype=${mediatype}`);

if (mentionsEveryOne) {
  try {
    const metadata = await session.sock.groupMetadata(jid);
    msgContent.mentions = metadata.participants.map(p => p.id);
    console.log(`[sendMedia] Mentions added: ${msgContent.mentions.length} participants`);
  } catch (mentionErr) {
    console.error(`[sendMedia] Failed to fetch group metadata for mentions:`, mentionErr.message);
  }
}

console.log(`[sendMedia] Sending with mentions: ${!!msgContent.mentions}`);
```

Tambem adicionar log no endpoint `sendText` (que funciona) para comparacao:

```javascript
console.log(`[sendText] mentionsEveryOne=${mentionsEveryOne}, jid=${jid}`);
```

### Apos o deploy

Na VPS, reconstruir o container **sem cache**:

```bash
cd /opt/whats-grupos
git pull
docker build --no-cache -t baileys-server ./baileys-server
docker rm -f baileys-server
docker run -d --name baileys-server --restart unless-stopped \
  --network supabase_default \
  -p 127.0.0.1:3100:3100 -v baileys-data:/data baileys-server
```

Depois, enviar uma imagem com mencao e verificar os logs:

```bash
docker logs baileys-server --tail 20
```

Os logs vao mostrar exatamente onde o problema esta:
- Se `mentionsEveryOne=undefined` -> o process-queue nao esta enviando o campo
- Se `mentionsEveryOne=true` mas "Failed to fetch" -> erro ao buscar participantes
- Se `mentionsEveryOne=true` e "Mentions added" -> funciona mas o WhatsApp ignora

## Detalhes tecnicos

Arquivos modificados:
- `baileys-server/server.js` - Adicionar console.log e trocar `catch (_) {}` por `catch` com log de erro
