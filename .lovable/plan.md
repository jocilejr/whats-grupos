

## Problema

1. **Erro de schema cache** persiste para `baileys_api_key` — o `AdminApiDocs` usa `.single()` em vez de `.maybeSingle()`, e o PostgREST pode não ter recarregado o schema.
2. **URL editável desnecessária** — o campo `vps_api_url` não deveria existir no AdminConfig. A URL deve vir automaticamente de `baileys_api_url` do `global_config`.
3. **API Key** deve ser editável no AdminConfig e servir como chave padrão para requisições externas na documentação.

## Alterações

### 1. Migração SQL — Recarregar schema cache
- Executar `NOTIFY pgrst, 'reload schema'` para forçar o PostgREST a reconhecer `baileys_api_key`.

### 2. AdminConfig.tsx — Remover campo URL
- Remover estado `vpsApiUrl` e o campo "URL da API da VPS".
- Remover `vps_api_url` do payload de save.
- Manter apenas card de API Key (para requisições externas) e OpenAI.

### 3. AdminApiDocs.tsx — Usar baileys_api_url como Base URL
- Mudar query de `vps_api_url, baileys_api_key` para `baileys_api_url, baileys_api_key`.
- Usar `.maybeSingle()` em vez de `.single()` para evitar erro quando não há registro.
- Mostrar `baileys_api_url` como Base URL na documentação.

### Detalhes técnicos
- `baileys_api_url` no banco = `http://baileys-server:3100` (endereço interno Docker).
- `baileys_api_key` no banco = `""` (vazio). A seção API Key já mostra alerta quando vazia.
- O `NOTIFY pgrst` resolve o erro de schema cache de forma definitiva.

