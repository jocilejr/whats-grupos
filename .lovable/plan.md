

# Corrigir 3 Problemas: Fantasmas, Exclusao de Erros e Grupos

## ✅ Problema 2: Nao consegue deletar itens com erro da fila (FEITO)

Mudancas aplicadas em `src/pages/QueuePage.tsx`:
- Adicionada funcao `handleDeleteSelected` para deletar itens selecionados
- Adicionado botao "Deletar selecionados" (vermelho) ao lado do "Reenviar selecionados"
- `handleClearAllQueue` agora inclui status `error` na exclusao

## ⏳ Problema 1: Entradas fantasma "RosanaGrupos" (PENDENTE - VPS)

Executar na VPS:

```bash
docker compose -f /opt/supabase-docker/docker/docker-compose.yml exec -T db psql -U postgres -d postgres <<'EOF'
-- Corrigir TUDO de uma vez
UPDATE scheduled_messages SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos';
UPDATE campaigns SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos';
UPDATE api_configs SET instance_name = 'Rosana' WHERE instance_name = 'RosanaGrupos';
DELETE FROM message_queue WHERE instance_name = 'RosanaGrupos';
EOF
```

## ⏳ Problema 3: Grupos nao sincronizam (RESOLVIDO COM PROBLEMA 1)

Sera corrigido automaticamente ao executar o SQL acima.

## Deploy

```bash
cd /opt/whats-grupos && git pull && sudo ./scripts/deploy.sh
```

