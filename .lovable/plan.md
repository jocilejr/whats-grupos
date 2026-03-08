

## Problema Confirmado

O limite de menções no `baileys-server` está configurado em **300 participantes**. Todos os seus grupos têm entre 692 e 1025 membros, então as menções são **sempre ignoradas**.

Único grupo que funcionou: `120363384420644183@g.us` com 181 participantes (abaixo do limite).

## Solução

Alterar `MAX_MENTIONS_PARTICIPANTS` de `300` para `2000` no arquivo `baileys-server/server.js`.

### Alteração

**Arquivo:** `baileys-server/server.js` (linha 14)

```js
// DE:
const MAX_MENTIONS_PARTICIPANTS = 300;

// PARA:
const MAX_MENTIONS_PARTICIPANTS = 2000;
```

### Após implementar

Rebuild e restart do container na VPS:

```bash
cd /opt/whats-grupos
docker compose build baileys-server
docker compose up -d baileys-server
```

