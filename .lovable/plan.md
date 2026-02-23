

# Corrigir: instance_name deve vir da campanha, nao da scheduled_message

## Problema

Na funcao `enqueueMessage` do `send-scheduled-messages/index.ts`, linha 166:

```
const instanceName = msg.instance_name || campaign?.instance_name || configInstanceName;
```

A prioridade esta errada. O `msg.instance_name` (da tabela `scheduled_messages`) contem o valor antigo "RosanaGrupos", e como ele tem prioridade sobre `campaign?.instance_name`, o valor correto "Rosana" da campanha nunca e usado.

## Solucao

### Arquivo: `supabase/functions/send-scheduled-messages/index.ts`

Inverter a prioridade na linha 166 para que a campanha seja a fonte da verdade:

**Antes:**
```typescript
const instanceName = msg.instance_name || campaign?.instance_name || configInstanceName;
```

**Depois:**
```typescript
const instanceName = campaign?.instance_name || msg.instance_name || configInstanceName;
```

Isso garante que, quando a mensagem pertence a uma campanha, o `instance_name` configurado na campanha ("Rosana") e usado. So usa o da `scheduled_messages` como fallback se nao houver campanha.

## Fluxo corrigido

```text
Campanha "Grupo Principal" (instance_name: "Rosana")
  --> enqueueMessage prioriza campaign.instance_name = "Rosana"
    --> message_queue recebe instance_name = "Rosana"
      --> process-queue usa "Rosana" para montar a URL
```

## Resumo

| Alteracao | Detalhe |
|-----------|---------|
| Inverter prioridade do `instance_name` | `campaign?.instance_name` antes de `msg.instance_name` |
| Arquivo | `supabase/functions/send-scheduled-messages/index.ts`, linha 166 |

