

## Problema: Audio bugado no WhatsApp

O erro "O áudio não está disponível porque há algo errado com o arquivo de áudio" acontece porque o Baileys server **hardcoda** o mimetype como `audio/ogg; codecs=opus` e `ptt: true` (voice note), independente do formato real do arquivo enviado.

Se o usuario envia um MP3, M4A ou qualquer formato que nao seja OGG Opus, o WhatsApp recebe metadados dizendo "isto e OGG Opus" mas o conteudo real e outro formato, resultando no erro.

### Correcao

**Arquivo: `baileys-server/server.js`** (rota `/message/sendWhatsAppAudio`)

Detectar o formato real do audio pela extensao da URL e ajustar o mimetype automaticamente:

```javascript
const { number, audio } = req.body;
const jid = number.includes('@') ? number : `${number}@g.us`;

// Detect mimetype from URL extension
const audioUrl = audio.toLowerCase();
let mimetype = 'audio/ogg; codecs=opus';
let ptt = true;

if (audioUrl.includes('.mp3')) {
  mimetype = 'audio/mpeg';
} else if (audioUrl.includes('.m4a') || audioUrl.includes('.mp4')) {
  mimetype = 'audio/mp4';
} else if (audioUrl.includes('.wav')) {
  mimetype = 'audio/wav';
  ptt = false; // WAV not supported as voice note
} else if (audioUrl.includes('.aac')) {
  mimetype = 'audio/aac';
}

const result = await session.sock.sendMessage(jid, {
  audio: { url: audio },
  mimetype,
  ptt,
});
```

Isso garante que o mimetype enviado ao WhatsApp corresponda ao formato real do arquivo, eliminando o erro de "arquivo de audio corrompido".

### Resumo
| Arquivo | Mudanca |
|---|---|
| `baileys-server/server.js` | Detectar mimetype real do audio pela extensao ao inves de hardcodar `ogg/opus` |

Uma unica alteracao pontual no endpoint `sendWhatsAppAudio`.

