

# Corrigir: Mensagens nao chegam na fila quando provider e Baileys

## Problema

Na funcao `enqueueMessage` dentro de `supabase/functions/send-scheduled-messages/index.ts`, existe uma verificacao que exige que `evolution_api_url` esteja preenchido no `global_config`. Como voce usa apenas Baileys (sem Evolution API), esse campo esta vazio e a funcao retorna 0 silenciosamente -- as mensagens **nunca sao inseridas na fila**.

Trecho do problema (linhas 144-152):
```text
if (!apiUrl || apiUrl === "global" || !apiKey || apiKey === "global") {
    const { data: globalCfg } = await supabase.from("global_config")
      .select("evolution_api_url, evolution_api_key")...
    if (!globalCfg?.evolution_api_url) {
      return 0;  // <-- bloqueia tudo silenciosamente
    }
}
```

## Solucao

### 1. Corrigir `send-scheduled-messages/index.ts` (funcao `enqueueMessage`)

Alterar a logica de fallback para tambem verificar o provider configurado. Quando o provider for `baileys`, nao exigir `evolution_api_url` -- pois o `process-queue` ja resolve a URL correta em tempo de execucao.

**Antes (linhas 143-153):**
```typescript
if (!apiUrl || apiUrl === "global" || !apiKey || apiKey === "global") {
  const { data: globalCfg } = await supabase.from("global_config")
    .select("evolution_api_url, evolution_api_key").limit(1).maybeSingle();
  if (!globalCfg?.evolution_api_url) {
    console.error(`No global Evolution API config for message ${msg.id}`);
    return 0;
  }
  apiUrl = globalCfg.evolution_api_url;
  apiKey = globalCfg.evolution_api_key;
}
```

**Depois:**
```typescript
if (!apiUrl || apiUrl === "global" || !apiKey || apiKey === "global") {
  const { data: globalCfg } = await supabase.from("global_config")
    .select("evolution_api_url, evolution_api_key, whatsapp_provider")
    .limit(1).maybeSingle();

  const provider = globalCfg?.whatsapp_provider || "evolution";

  if (provider === "baileys") {
    // Baileys: URL resolvida no process-queue, nao precisa validar aqui
    apiUrl = "resolved-at-runtime";
    apiKey = "resolved-at-runtime";
  } else {
    if (!globalCfg?.evolution_api_url) {
      console.error(`No global Evolution API config for message ${msg.id}`);
      return 0;
    }
    apiUrl = globalCfg.evolution_api_url;
    apiKey = globalCfg.evolution_api_key;
  }
}
```

### 2. Corrigir toast no frontend (`CampaignMessageList.tsx`, linha 103)

O toast le `data?.processed` mas a Edge Function retorna `data?.queued`.

**Antes:**
```typescript
description: `${data?.processed || 0} grupo(s) processado(s)...`
```

**Depois:**
```typescript
description: `${data?.queued || 0} grupo(s) enfileirado(s)...`
```

## Resumo

| Arquivo | Problema | Correcao |
|---------|----------|----------|
| `supabase/functions/send-scheduled-messages/index.ts` | Exige `evolution_api_url` mesmo quando provider e Baileys, bloqueando o enfileiramento | Verificar o provider e pular validacao de URL para Baileys |
| `src/components/campaigns/CampaignMessageList.tsx` | Toast le campo inexistente `processed` ao inves de `queued` | Trocar para `data?.queued` |

Apos aplicar, tanto o envio manual ("Enviar agora") quanto o cron das 7h vao funcionar corretamente com Baileys.
