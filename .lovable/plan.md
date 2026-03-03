

## Plano: Atualizar Baileys para v7.0.0-rc.9

A versão atual no `baileys-server/package.json` é `^6.7.16`. O usuário quer atualizar para `v7.0.0-rc.9`.

### Mudanças

**1. `baileys-server/package.json`**
- Alterar `@whiskeysockets/baileys` de `"^6.7.16"` para `"7.0.0-rc.9"` (versão exata, sem `^`, para evitar atualizações automáticas de RC).

**2. `baileys-server/server.js`**
- Revisar imports e chamadas da API do Baileys para compatibilidade com v7 (possíveis breaking changes em relação à v6).
- Adicionar versão no endpoint `/health` para facilitar verificação futura.

**3. Pós-deploy (manual na VPS)**
- Rebuild do container Docker: `docker build -t baileys-server ./baileys-server && docker rm -f baileys-server && docker run ...`
- Ou via `./scripts/deploy.sh` que já faz isso automaticamente.

### Nota importante
A v7 é uma release candidate (RC) e pode conter breaking changes em relação à v6. Será necessário verificar o `server.js` para garantir compatibilidade com a nova API.

