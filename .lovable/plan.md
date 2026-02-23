

# Corrigir Sincronizacao de Grupos na VPS

## Problema Identificado

A Edge Function `sync-group-stats` retorna "0 grupos" mas **esconde os erros**. O toast so mostra `synced/joined/left` e ignora o campo `errors` da resposta. Isso impede de saber o que realmente esta falhando.

Alem disso, a resolucao da URL do Baileys e **diferente** entre as Edge Functions:
- `process-queue` (que funciona): hardcoda `http://baileys-server:3100` quando o provider e "baileys"
- `sync-group-stats` (que falha): le `global_config.baileys_api_url`, que pode estar vazio ou com valor errado

## Plano de Implementacao

### 1. Corrigir `sync-group-stats` - Usar mesma logica de URL do `process-queue`

**Arquivo**: `supabase/functions/sync-group-stats/index.ts`

Mudar a resolucao da URL do Baileys (linha 67-74) para:
- Ler `global_config.whatsapp_provider` e `global_config.baileys_api_url`
- Se provider for "baileys", usar `baileys_api_url` do global_config, com fallback para `http://baileys-server:3100`
- Logar a URL usada para debug

### 2. Mostrar erros no toast do frontend

**Arquivo**: `src/pages/GroupsPage.tsx`

No `onSuccess` da mutation de sync (linha ~115), verificar se `data.errors` existe e mostra-los:

```text
onSuccess: (data) => {
  if (data.errors?.length) {
    toast.error(`Erros: ${data.errors.join(", ")}`);
  } else {
    toast.success(`Sincronizacao concluida! ${data.synced} grupos...`);
  }
}
```

### 3. Deploy na VPS

```bash
cd /opt/whats-grupos && git pull && sudo ./scripts/deploy.sh
```

## Resultado Esperado

1. Se houver erro de conexao com o Baileys, o toast mostrara a mensagem de erro real
2. A URL do Baileys sera resolvida corretamente, igual ao `process-queue` que ja funciona
3. Os grupos serao sincronizados com sucesso

