

# Corrigir URL do Baileys na Sincronizacao de Grupos

## Problema

O erro no toast mostra claramente:
```
http://localhost:3100/group/fetchAllGroups/Rosana - Connection refused
```

A Edge Function `sync-group-stats` le `baileys_api_url` do banco de dados, que na VPS esta configurado como `http://localhost:3100`. Porem, a Edge Function roda em um container Docker separado e nao consegue acessar `localhost` do host.

O `process-queue` funciona porque **ignora** o valor do banco e hardcoda `http://baileys-server:3100` quando o provider e "baileys".

## Plano

### 1. Corrigir `sync-group-stats` - Copiar logica do `process-queue`

**Arquivo**: `supabase/functions/sync-group-stats/index.ts`

Substituir a resolucao de URL (linhas 67-78) para usar a mesma funcao `getProviderConfig` do `process-queue`:

```text
function getProviderConfig(globalConfig: any) {
  const provider = globalConfig?.whatsapp_provider || "baileys";
  if (provider === "baileys") {
    return { provider: "baileys", apiUrl: "http://baileys-server:3100" };
  }
  return {
    provider: "evolution",
    apiUrl: (globalConfig?.baileys_api_url || "http://baileys-server:3100"),
  };
}
```

Quando o provider e "baileys", o valor do banco e **ignorado** e usa-se o nome do servico Docker diretamente. Isso e exatamente o que o `process-queue` faz e funciona.

### 2. Corrigir `global_config` na VPS (SQL)

Alem do codigo, corrigir o valor no banco para evitar problemas futuros:

```bash
docker compose -f /opt/supabase-docker/docker/docker-compose.yml exec -T db psql -U postgres -d postgres -c \
  "UPDATE global_config SET whatsapp_provider = 'baileys', baileys_api_url = 'http://baileys-server:3100';"
```

### 3. Deploy na VPS

```bash
cd /opt/whats-grupos && git pull && sudo ./scripts/deploy.sh
```

