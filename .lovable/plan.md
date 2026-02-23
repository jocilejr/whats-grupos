# Corrigir erro "Instance not connected" no process-queue

## Diagnostico

O problema nao tem relacao com provider Evolution/Baileys. O erro ocorre porque:

1. A campanha foi criada com a instancia **"RosanaGrupos"** (nome antigo)
2. A instancia foi renomeada/recriada como **"Rosana"**
3. O `send-scheduled-messages` grava `instance_name: "RosanaGrupos"` na `message_queue` (vindo da campanha)
4. O `process-queue` usa esse nome diretamente para montar a URL: `/message/sendText/RosanaGrupos`
5. O Baileys responde "Instance not connected" porque so conhece "Rosana"

## Correcao no codigo

### Arquivo: `supabase/functions/process-queue/index.ts`

Na linha 122-123, quando o `process-queue` busca a config do usuario (`api_configs`), ele so le `api_url` e `api_key`. Precisa tambem ler `instance_name` e usa-lo como fonte da verdade, pois e o nome atualizado da instancia.  
  
O instance name se encontra na CAMPANHA onde a instancia foi executada.

**Antes (linhas 120-130):**

```typescript
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

**Depois:**

```typescript
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
    // Usar o nome atualizado da instancia da api_configs
    if (config.instance_name) {
      resolvedInstanceName = config.instance_name;
    }
  }
}
```

E na linha 143, trocar `item.instance_name` por `resolvedInstanceName`:

```typescript
const { endpoint, body } = buildMessagePayload(
  item.message_type, apiUrl, resolvedInstanceName, item.group_id, content
);
```

Tambem atualizar os logs de `message_logs` para gravar o nome correto (`resolvedInstanceName` ao inves de `item.instance_name`).

### Correcao de dados na VPS

Alem da correcao de codigo, atualizar o nome da instancia nas campanhas existentes:

```sql
UPDATE campaigns SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos';
UPDATE scheduled_messages SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos';
UPDATE message_queue SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos' AND status = 'pending';
```

## Resumo


| Correcao                                           | Onde                   | Impacto                                      |
| -------------------------------------------------- | ---------------------- | -------------------------------------------- |
| process-queue ler `instance_name` da `api_configs` | Codigo (Edge Function) | Resolve automaticamente nomes desatualizados |
| Atualizar dados antigos                            | SQL na VPS             | Corrige campanhas e itens pendentes na fila  |
