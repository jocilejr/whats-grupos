

# Plano: Integrar Baileys como Provedor WhatsApp Alternativo

## Resumo
Adicionar o Baileys como opcao alternativa a Evolution API. Um switcher na Configuracao Global permite escolher qual provedor usar. O Baileys roda como um servidor Node.js na propria VPS, expondo uma API REST compativel que as edge functions consomem da mesma forma.

## Como Funciona

O admin acessa Configuracao Global e ve um seletor com duas opcoes:
- **Evolution API** (padrao atual) -- usa URL e Key externos
- **Baileys (Local)** -- usa o servidor na propria VPS, sem dependencia externa

Quando Baileys esta selecionado, as edge functions enviam as requisicoes para `http://localhost:3100` (o servidor Baileys local) em vez da Evolution API.

## O Que Sera Feito

### 1. Banco de dados -- nova coluna `whatsapp_provider`
Adicionar coluna `whatsapp_provider` na tabela `global_config` com valores `evolution` (padrao) ou `baileys`. Tambem adicionar `baileys_api_url` com default `http://localhost:3100`.

### 2. Servidor Baileys (novo servico na VPS)
Criar `baileys-server/` na raiz do projeto com:
- `server.js` -- servidor Express leve que expoe endpoints REST compativeis
- `package.json` -- dependencias (baileys, express, qrcode)
- `Dockerfile` -- para rodar como container Docker

Endpoints expostos (compativeis com Evolution API):
- `POST /instance/create` -- cria sessao Baileys
- `GET /instance/connect/:name` -- retorna QR Code
- `GET /instance/connectionState/:name` -- status da conexao
- `DELETE /instance/delete/:name` -- remove sessao
- `GET /group/fetchAllGroups/:name` -- lista grupos
- `POST /message/sendText/:name` -- envia texto
- `POST /message/sendMedia/:name` -- envia midia
- `POST /message/sendWhatsAppAudio/:name` -- envia audio
- `GET /instance/fetchInstances` -- lista instancias

O servidor armazena as sessoes em `/data/baileys-sessions/` (volume persistente).

### 3. Atualizar Edge Functions
Modificar `evolution-api/index.ts` e `process-queue/index.ts`:
- Ler `whatsapp_provider` e `baileys_api_url` do `global_config`
- Se `provider === 'baileys'`: usar `baileys_api_url` e sem header `apikey`
- Se `provider === 'evolution'`: manter comportamento atual

### 4. Atualizar AdminConfig (UI)
Adicionar na pagina de Configuracao Global:
- Seletor "Provedor WhatsApp" com opcoes Evolution API e Baileys
- Quando Baileys selecionado: mostrar campo URL (default `http://localhost:3100`) e botao Testar
- Quando Evolution selecionado: mostrar campos atuais (URL + Key)
- O card muda visualmente conforme a selecao

### 5. Atualizar Instalador (`install.sh`)
Adicionar novo passo (entre 7 e 8):
- Instalar Baileys Server como container Docker
- `docker build` + `docker run` com volume para sessoes
- Verificar que a porta 3100 esta acessivel localmente
- Configurar restart automatico (`--restart unless-stopped`)

## Detalhes Tecnicos

### Migracao SQL
```sql
ALTER TABLE global_config 
  ADD COLUMN IF NOT EXISTS whatsapp_provider text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS baileys_api_url text NOT NULL DEFAULT 'http://localhost:3100';
```

### Estrutura do Baileys Server
```text
baileys-server/
  package.json
  server.js        -- Express + @whiskeysockets/baileys
  Dockerfile
  .dockerignore
```

O servidor usa `@whiskeysockets/baileys` (fork ativo e mantido) e armazena as credenciais de sessao em disco para persistencia entre reinicializacoes.

### Logica nas Edge Functions (pseudo-codigo)
```text
globalConfig = buscar global_config
if provider == 'baileys':
  apiUrl = globalConfig.baileys_api_url
  headers = { "Content-Type": "application/json" }
else:
  apiUrl = globalConfig.evolution_api_url
  headers = { apikey: globalConfig.evolution_api_key }
```

Os endpoints sao compativeis, entao o `buildMessagePayload` no `process-queue` funciona sem alteracao.

### Novo passo no install.sh
```text
7.5/10 - Instalando Baileys Server (backup WhatsApp)
  - docker build -t baileys-server ./baileys-server
  - docker run -d --name baileys-server --restart unless-stopped \
      -p 127.0.0.1:3100:3100 \
      -v baileys-data:/data \
      baileys-server
```

### UI do AdminConfig
O card de configuracao do WhatsApp tera:
- Um seletor segmentado (tabs) no topo: "Evolution API" | "Baileys (Local)"
- Cada tab mostra os campos relevantes
- O botao Salvar grava o provedor escolhido + credenciais

## Arquivos Modificados/Criados
1. **Migracao SQL** -- nova coluna em `global_config`
2. **baileys-server/server.js** -- NOVO: servidor REST do Baileys
3. **baileys-server/package.json** -- NOVO: dependencias
4. **baileys-server/Dockerfile** -- NOVO: containerizacao
5. **supabase/functions/evolution-api/index.ts** -- roteamento por provedor
6. **supabase/functions/process-queue/index.ts** -- roteamento por provedor
7. **src/pages/admin/AdminConfig.tsx** -- switcher de provedor na UI
8. **install.sh** -- passo adicional para instalar Baileys Server
9. **scripts/deploy.sh** -- rebuild do Baileys Server no deploy

## Resultado
- Admin escolhe o provedor com um clique
- Baileys roda localmente sem depender de servico externo
- Troca entre provedores e instantanea (so muda config)
- Ambos coexistem -- pode voltar para Evolution API a qualquer momento

