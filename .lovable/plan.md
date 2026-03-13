

## Problema: Audio MP3 continua indisponivel no WhatsApp

A deteccao de mimetype esta correta (`.mp3` → `audio/mpeg`), mas o problema real e que o **Baileys nao consegue enviar MP3 como voice note (`ptt: true`)**. O WhatsApp exige formato OGG Opus para voice notes. Quando recebe MP3 marcado como `ptt`, o arquivo fica corrompido.

Alem disso, enviar audio via URL direta pode falhar se o Baileys tiver problemas ao baixar o arquivo remotamente.

### Correcao em `baileys-server/server.js`

Duas mudancas:

**1. MP3 nao pode ser `ptt: true`** - apenas OGG Opus funciona como voice note no WhatsApp:

```javascript
if (audioUrl.includes('.mp3')) {
  mimetype = 'audio/mpeg';
  ptt = false; // MP3 não suporta voice note
} else if (audioUrl.includes('.m4a') || audioUrl.includes('.mp4')) {
  mimetype = 'audio/mp4';
  ptt = false;
} else if (audioUrl.includes('.wav')) {
  mimetype = 'audio/wav';
  ptt = false;
} else if (audioUrl.includes('.aac')) {
  mimetype = 'audio/aac';
  ptt = false;
}
// Apenas OGG Opus (default) mantém ptt = true
```

**2. Baixar o audio como buffer antes de enviar** - evita problemas de fetch remoto pelo Baileys:

```javascript
const axios = require('axios');
// ...
const response = await axios.get(audio, { responseType: 'arraybuffer' });
const audioBuffer = Buffer.from(response.data);

const result = await session.sock.sendMessage(jid, {
  audio: audioBuffer,
  mimetype,
  ptt,
});
```

### Resumo
| Mudanca | Motivo |
|---|---|
| `ptt = false` para todos exceto OGG | WhatsApp so aceita OGG Opus como voice note |
| Baixar audio como buffer | Evita falhas do Baileys ao buscar URLs remotas |

Isso fara o MP3 aparecer como mensagem de audio reproduzivel (nao como bolha de voz), mas funcionando corretamente.

