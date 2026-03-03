

## Plano: Adicionar autenticação por API Key no Baileys Server

### Problema
Os endpoints do Baileys Server estão abertos — qualquer pessoa com a URL pública pode criar instâncias, enviar mensagens e manipular grupos sem autenticação.

### Solução
Adicionar um middleware de validação de API Key no `baileys-server/server.js` e exibir/gerenciar essa chave na página de documentação.

### Alterações

**1. `baileys-server/server.js`** — Middleware de autenticação

- Ler a variável de ambiente `BAILEYS_API_KEY` na inicialização
- Criar um middleware Express que intercepta todas as rotas e valida o header `apikey` (compatível com o padrão Evolution API)
- Retornar `401 Unauthorized` se a chave estiver ausente ou incorreta
- Permitir apenas health-check (`GET /`) sem autenticação

**2. `src/pages/admin/AdminApiDocs.tsx`** — Exibir API Key na documentação

- Buscar `baileys_api_key` do `global_config` (novo campo)
- Exibir a chave na seção Base URL com botão de copiar (mascarada por padrão)
- Incluir o header `apikey` nos cURLs gerados automaticamente
- Adicionar nota na documentação sobre o header obrigatório

**3. Migração SQL** — Novo campo na `global_config`

```sql
ALTER TABLE public.global_config
ADD COLUMN IF NOT EXISTS baileys_api_key text NOT NULL DEFAULT '';
```

**4. `docker-compose` / `deploy.sh`** — Passar a variável de ambiente

- Adicionar `BAILEYS_API_KEY` como variável de ambiente do container, lida a partir de `global_config` ou do `.credentials`

### Fluxo de autenticação
```text
Cliente → POST /message/sendText/instancia
         Header: apikey: minha-chave-secreta
         ↓
Middleware → BAILEYS_API_KEY == header.apikey?
         ├─ Sim → processa normalmente
         └─ Não → 401 { error: "Unauthorized" }
```

### Impacto
- Requisições internas (Edge Functions `process-queue`) precisarão enviar o header `apikey` — será adicionado na lógica da Edge Function
- Requisições externas (n8n, CRMs) deverão incluir o header na configuração

