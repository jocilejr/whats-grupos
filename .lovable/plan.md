

# Correcoes de Seguranca de Alta Prioridade

Tres frentes de correcao para preparar a aplicacao para producao.

---

## 1. Restringir CORS nas Edge Functions

Atualmente todas as Edge Functions usam `Access-Control-Allow-Origin: *`, permitindo que qualquer site faca requisicoes. A correcao consiste em ler a origem permitida de uma variavel de ambiente (`ALLOWED_ORIGIN`) e validar contra o header `Origin` da requisicao.

### Arquivos a modificar (6 Edge Functions)
- `supabase/functions/evolution-api/index.ts`
- `supabase/functions/generate-ai-message/index.ts`
- `supabase/functions/process-queue/index.ts`
- `supabase/functions/send-scheduled-messages/index.ts`
- `supabase/functions/backup-export/index.ts`
- `supabase/functions/admin-api/index.ts`

### Padrao aplicado em cada funcao
```text
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",");

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, ...",
  };
}
```

- Funcoes internas chamadas por cron/outras funcoes (`process-queue`, `send-scheduled-messages`) manterao `*` como fallback seguro pois nao sao chamadas do browser.
- Sera necessario adicionar o secret `ALLOWED_ORIGINS` com o valor do dominio de producao (ex: `https://app.simplificandogrupos.com`).

---

## 2. Corrigir Limite de 1000 Rows nas Queries de Logs

Queries no frontend que buscam `message_logs` sem `.limit()` estao sujeitas ao teto de 1000 linhas do Supabase, retornando dados incompletos silenciosamente.

### Problemas identificados

| Arquivo | Query | Problema |
|---------|-------|----------|
| `Dashboard.tsx` (linha 55) | `select("id, status", { count: "exact" })` | Busca todos os IDs so para contar - deveria usar `head: true` |
| `Dashboard.tsx` (linha 77) | `select(...).gte("created_at", 30d)` | Sem limite, pode perder dados acima de 1000 |
| `Dashboard.tsx` (linha 95) | `select("status, message_type").gte(today)` | OK para volume diario, mas sem protecao |
| `backup.ts` (linha 63) | `select("*")` | Sem limite nem paginacao, perde logs acima de 1000 |

### Correcoes

**Dashboard.tsx**
- Linha 55: Adicionar `head: true` na query de contagem total (ja usa `count: "exact"` mas busca dados desnecessarios)
- Linha 77: Adicionar `.limit(5000)` para um teto seguro (30 dias de dados para graficos)
- Linha 95: Adicionar `.limit(5000)` como protecao

**backup.ts**
- Implementar paginacao para exportar TODOS os logs:
```text
async function fetchAllLogs(userId) {
  let allLogs = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("message_logs").select("*")
      .eq("user_id", userId)
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    allLogs.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allLogs;
}
```

---

## 3. Rate Limiting nas Edge Functions

Adicionar verificacao de limite de mensagens por hora antes de permitir envios, baseado no plano do usuario (`user_plans.max_messages_per_hour`).

### Funcoes afetadas
- `supabase/functions/process-queue/index.ts` - Verificar limite ANTES de enviar cada mensagem
- `supabase/functions/evolution-api/index.ts` - Verificar limite nas acoes de envio direto (`sendText`, `sendMedia`, etc.)

### Logica de rate limiting no process-queue
Antes de cada envio, consultar:
```text
1. Buscar max_messages_per_hour do user_plans para o user_id do item
2. Contar message_logs da ultima hora para esse user_id
3. Se count >= max, marcar item como "error" com mensagem de limite e pular
```

### Logica de rate limiting no evolution-api
Para acoes de envio (`sendText`, `sendMedia`, `sendAudio`, etc.):
```text
1. Buscar user_plans.max_messages_per_hour
2. Contar message_logs da ultima hora
3. Retornar 429 se limite atingido
```

---

## Adicao de Indices no Banco de Dados

Para suportar as novas queries de rate limiting e melhorar performance geral, criar indices:

```text
CREATE INDEX idx_message_logs_user_created ON message_logs(user_id, created_at DESC);
CREATE INDEX idx_message_queue_status_priority ON message_queue(status, priority, created_at);
CREATE INDEX idx_scheduled_messages_next_run ON scheduled_messages(is_active, next_run_at)
  WHERE is_active = true;
```

---

## Resumo de Alteracoes

| Arquivo | Mudanca |
|---------|---------|
| 6 Edge Functions | CORS restritivo com `ALLOWED_ORIGINS` |
| `process-queue/index.ts` | Rate limiting por usuario |
| `evolution-api/index.ts` | Rate limiting nas acoes de envio |
| `Dashboard.tsx` | `head: true` e `.limit()` nas queries |
| `backup.ts` | Paginacao para buscar todos os logs |
| Migracao SQL | 3 indices de performance |
| Secret | `ALLOWED_ORIGINS` a ser configurado |

### Ordem de execucao
1. Adicionar secret `ALLOWED_ORIGINS`
2. Criar indices SQL (migracao)
3. Corrigir queries do frontend (`Dashboard.tsx`, `backup.ts`)
4. Atualizar CORS em todas as Edge Functions
5. Implementar rate limiting no `process-queue` e `evolution-api`

