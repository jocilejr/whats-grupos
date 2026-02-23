
# Corrigir: process-queue deve respeitar o instance_name da campanha

## Problema

A correção anterior fez o `process-queue` sobrescrever o `instance_name` da fila com o da tabela `api_configs`. Isso esta errado porque:

1. O usuario seleciona a instancia na **campanha** (ex: "Rosana")
2. O `send-scheduled-messages` grava esse nome na `message_queue`
3. O `process-queue` deveria usar esse nome, mas agora sobrescreve com o da `api_configs`

O nome na `api_configs` pode estar desatualizado ou ser diferente do que o usuario escolheu na campanha.

## Solucao

### Arquivo: `supabase/functions/process-queue/index.ts`

Remover a logica que sobrescreve o `instance_name`. O `process-queue` deve buscar apenas `api_url` e `api_key` da `api_configs`, e usar o `item.instance_name` da fila como fonte da verdade.

**Antes (linhas 120-134):**
```text
let resolvedInstanceName = item.instance_name;

if (item.api_config_id) {
  const { data: config } = await supabase
    .from("api_configs")
    .select("api_url, api_key, instance_name")
    .eq("id", item.api_config_id)
    .maybeSingle();
  if (config) {
    apiUrl = config.api_url;
    apiKey = config.api_key;
    if (config.instance_name) {
      resolvedInstanceName = config.instance_name;
    }
  }
}
```

**Depois:**
```text
if (item.api_config_id) {
  const { data: config } = await supabase
    .from("api_configs")
    .select("api_url, api_key")
    .eq("id", item.api_config_id)
    .maybeSingle();
  if (config) {
    apiUrl = config.api_url;
    apiKey = config.api_key;
  }
}
```

E trocar todas as referencias a `resolvedInstanceName` de volta para `item.instance_name` (nas chamadas de `buildMessagePayload` e nos inserts de `message_logs`).

## Por que isso funciona

O fluxo correto e:

```text
Campanha (instance_name: "Rosana")
  --> send-scheduled-messages grava na fila (instance_name: "Rosana")
    --> process-queue usa item.instance_name ("Rosana") para montar a URL
```

O `process-queue` so precisa da `api_configs` para obter `api_url` e `api_key` (ou cair no fallback global). O nome da instancia ja vem correto da fila.

## Resumo

| Alteracao | Detalhe |
|-----------|---------|
| Remover override de `instance_name` no `process-queue` | Usar `item.instance_name` da fila (que veio da campanha) |
| Remover variavel `resolvedInstanceName` | Voltar a usar `item.instance_name` em todos os pontos |
