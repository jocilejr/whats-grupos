

## Problema

O erro **"Could not find the 'baileys_api_key' column of 'global_config' in the schema cache"** aparece porque o código usa `(config as any).baileys_api_key` — o cast `as any` contorna o TypeScript mas o PostgREST schema cache pode não ter atualizado. Além disso, ainda existem referências à Evolution API espalhadas por todo o código (frontend e edge functions).

## Plano de Alterações

### 1. AdminConfig.tsx — Limpar referências Evolution
- Remover estados `apiUrl` e `apiKey` (eram da Evolution)
- Remover função `testConnection` (era da Evolution)
- No payload do `save`, parar de enviar `evolution_api_url`, `evolution_api_key`, `whatsapp_provider`
- Remover os casts `(config as any)` — usar `config.baileys_api_key`, `config.openai_api_key`, `config.vps_api_url` diretamente (já existem nos types)
- Selecionar apenas os campos necessários no `select`: `id, vps_api_url, baileys_api_key, openai_api_key, queue_delay_seconds`

### 2. Edge Function: evolution-api/index.ts — Simplificar para Baileys only
- Remover `getProviderConfig` com branch Evolution
- Hardcode: `apiUrl = "http://baileys-server:3100"`, headers sem apikey (conexão interna)
- Remover referência a `evolution_api_url`, `evolution_api_key`, `whatsapp_provider`

### 3. Edge Function: process-queue/index.ts — Simplificar provider
- Remover `getProviderConfig` e branch Evolution
- Sempre usar `baileys_api_url` do global config (ou fallback `http://baileys-server:3100`)
- Não enviar `apikey` header nas chamadas internas (apenas `Content-Type`)

### 4. Edge Function: send-scheduled-messages/index.ts — Simplificar fallback
- No fallback global, remover seleção de `evolution_api_url`, `evolution_api_key`, `whatsapp_provider`
- Sempre tratar como Baileys: `apiUrl = "resolved-at-runtime"`, `apiKey = "resolved-at-runtime"`

### 5. Outros arquivos frontend que referenciam "evolution"
- `GroupSelector.tsx`, `ScheduledMessageForm.tsx`, `CampaignDialog.tsx`, `StatusPage.tsx` — renomear URLs de endpoint de `evolution-api` para manter consistência (a edge function ainda se chama `evolution-api`, então as chamadas continuam funcionando; apenas limpar nomes de variáveis como `evolutionInstance`)

### Detalhes técnicos
- A coluna `baileys_api_key` **existe** no banco (confirmado via query). O erro de schema cache é transitório ou causado pelo `select("*")` com tipo incompleto.
- Trocar `select("*")` por `select("id, vps_api_url, baileys_api_key, openai_api_key, queue_delay_seconds")` resolve o problema.
- As colunas `evolution_api_url`, `evolution_api_key`, `whatsapp_provider` podem ser mantidas no banco por ora (não causam problema), evitando uma migração destrutiva.

