

# Corrigir 3 Problemas: Fantasmas, Exclusao de Erros e Grupos

## Problema 1: Entradas fantasma "RosanaGrupos"

O cron `send-scheduled-messages` chama `claim_due_messages()` que pega TODOS os `scheduled_messages` ativos com `next_run_at <= now()`. Se existem agendamentos antigos com `instance_name = 'RosanaGrupos'` na tabela `scheduled_messages`, eles continuam sendo enfileirados a cada ciclo.

A linha 166 do `send-scheduled-messages` define a instancia:
```text
const instanceName = campaign?.instance_name || msg.instance_name || configInstanceName;
```

Se a campanha nao tem `instance_name` definido, usa o do `scheduled_message` (que pode ser "RosanaGrupos"). Se nenhum dos dois tem, usa o do `api_configs`.

**Solucao**: Executar na VPS para identificar e corrigir os registros fantasma:

```bash
docker compose -f /opt/supabase-docker/docker/docker-compose.yml exec -T db psql -U postgres -d postgres <<'EOF'

-- 1. Ver quais scheduled_messages tem RosanaGrupos
SELECT id, instance_name, schedule_type, is_active, next_run_at
FROM scheduled_messages
WHERE instance_name = 'RosanaGrupos' AND is_active = true;

-- 2. Ver quais campanhas tem RosanaGrupos
SELECT id, name, instance_name FROM campaigns WHERE instance_name = 'RosanaGrupos';

-- 3. Ver api_configs
SELECT id, instance_name FROM api_configs WHERE instance_name = 'RosanaGrupos';

-- 4. Corrigir TUDO de uma vez
UPDATE scheduled_messages SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos';
UPDATE campaigns SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos';
UPDATE api_configs SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos';

-- 5. Limpar itens fantasma da fila
DELETE FROM message_queue WHERE instance_name = 'RosanaGrupos';

EOF
```

## Problema 2: Nao consegue deletar itens com erro da fila

**Arquivo**: `src/pages/QueuePage.tsx`

Mudancas:

1. Adicionar funcao `handleDeleteSelected` que deleta os itens selecionados (checkbox) com status `error`:
```text
const handleDeleteSelected = async () => {
  const ids = Array.from(selectedIds);
  const { error } = await supabase
    .from("message_queue")
    .delete()
    .in("id", ids);
  // feedback + limpar selecao
};
```

2. Adicionar botao "Deletar selecionados" (vermelho, com icone lixeira) ao lado do botao "Reenviar selecionados" no header -- aparece apenas quando ha itens selecionados

3. Alterar `handleClearAllQueue` (linha 240-251) para incluir status `error` na exclusao:
```text
.in("status", ["pending", "sent", "error"])
```

## Problema 3: Grupos nao sincronizam

Este problema sera resolvido automaticamente ao corrigir o `instance_name` na tabela `api_configs` (Problema 1). A Edge Function `sync-group-stats` usa o nome da instancia para chamar `/group/fetchAllGroups/{instanceName}` no Baileys. Com "RosanaGrupos" a chamada falha; com "Rosana" vai funcionar.

## Deploy

Apos as mudancas no codigo:
```bash
cd /opt/whats-grupos && git pull && sudo ./scripts/deploy.sh
```
