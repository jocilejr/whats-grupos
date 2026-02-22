

# Corrigir build do Baileys Server - Git ausente no Docker

## Problema

O `npm install` falha dentro do container Docker Alpine porque o Git nao esta instalado, e a dependencia `@whiskeysockets/baileys` requer Git para ser baixada.

## Solucao

Duas mudancas no arquivo `baileys-server/Dockerfile`:

1. Adicionar `RUN apk add --no-cache git` antes do `npm install` para instalar o Git no container Alpine
2. Trocar `--production` por `--omit=dev` (o flag antigo esta deprecado)

### Arquivo: baileys-server/Dockerfile

De:
```dockerfile
COPY package.json ./
RUN npm install --production
```

Para:
```dockerfile
RUN apk add --no-cache git
COPY package.json ./
RUN npm install --omit=dev
```

Apos aprovar, basta rodar novamente:
```bash
cd /opt/whats-grupos && git pull && chmod +x install.sh scripts/*.sh && sudo ./install.sh
```

