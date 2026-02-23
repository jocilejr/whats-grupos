# Corrigir: process-queue nunca e chamado  
  
Crie uma nova função: Um botão na fila que envia imediatamente a mensagem que está pendente.

## Problema

O sistema possui dois componentes:

- **send-scheduled-messages** (Produtor): enfileira mensagens na tabela `message_queue`
- **process-queue** (Consumidor): processa e envia as mensagens da fila

O cron job (pg_cron) so esta configurado para chamar `send-scheduled-messages` a cada minuto. A funcao `process-queue` nunca e chamada automaticamente, entao as mensagens ficam eternamente como "Pendente".

## Solucao

Adicionar um segundo cron job no script `setup-cron.sh` para chamar `process-queue` a cada minuto, logo apos o cron existente do `send-scheduled-messages`.

Alem disso, como o usuario ja tem o sistema rodando, fornecer o comando SQL para adicionar o cron job diretamente sem precisar rodar o script de instalacao completo novamente.

## Detalhes Tecnicos

### 1. Atualizar `scripts/setup-cron.sh`

Adicionar um segundo bloco de cron job para `process-queue`, usando o mesmo padrao do cron existente:

```sql
SELECT cron.schedule(
  'process-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<API_DOMAIN>/functions/v1/process-queue',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{"time":"now"}'::jsonb
  ) AS request_id;
  $$
);
```

### 2. Comando para o usuario aplicar imediatamente na VPS

O usuario precisara rodar o seguinte no banco de dados do Supabase (via `psql` ou Docker exec) para ativar o cron do `process-queue`, substituindo `<API_DOMAIN>` e `<ANON_KEY>` pelos valores reais:

```bash
cd /opt/supabase-docker/docker
docker compose exec -T db psql -U postgres -d postgres -c "
SELECT cron.schedule(
  'process-queue',
  '* * * * *',
  \$\$
  SELECT net.http_post(
    url := 'https://<API_DOMAIN>/functions/v1/process-queue',
    headers := '{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer <ANON_KEY>\"}'::jsonb,
    body := '{\"time\":\"now\"}'::jsonb
  ) AS request_id;
  \$\$
);
"
```

### Resultado esperado

Apos adicionar o cron job, o `process-queue` sera chamado automaticamente a cada minuto, processando as mensagens pendentes na fila e enviando-as pelo Baileys.