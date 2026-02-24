

# Correcao: URLs ja salvas no banco + Sync via VPS

## Problema

O botao "Sincronizar URLs agora" esta chamando a edge function no Lovable Cloud, mas essa funcao precisa acessar o servidor Baileys que so esta disponivel na rede Docker da VPS. Por isso da "Failed to fetch".

Alem disso, o usuario quer que ao abrir o dialog os links ja estejam carregados do banco - sem necessidade de sync manual.

## Solucao

### 1. Remover sync manual do frontend

O botao "Sincronizar URLs agora" sera alterado para chamar a API da VPS em vez do Lovable Cloud. A URL sera construida a partir da `api_url` salva na `api_configs` do usuario (que aponta para o dominio da VPS).

No `CampaignLeadsDialog.tsx`:
- Buscar a `api_configs` do usuario para obter o dominio da VPS
- Chamar `https://api.DOMINIO/functions/v1/sync-invite-links` em vez de `https://PROJECT_ID.supabase.co/functions/v1/sync-invite-links`
- Manter o botao como opcao secundaria, pois o cron ja roda a cada 15 minutos

### 2. Exibir dados do banco diretamente

O dialog ja busca `group_stats` com `invite_url` - isso esta correto. O problema e que os dados ainda nao foram populados pelo cron na VPS. Uma vez que o cron rode pela primeira vez, os dados aparecerao automaticamente.

### 3. Ajustar a edge function sync-invite-links para funcionar tambem no Lovable Cloud

A edge function `sync-invite-links` precisa resolver a URL do Baileys de forma mais robusta:
- Buscar `baileys_api_url` da `global_config`
- Usar essa URL para chamar o Baileys (que esta na VPS)

O problema atual e que a funcao usa `http://baileys-server:3100` que so funciona dentro da rede Docker da VPS.

## Detalhes Tecnicos

### Arquivo: `src/components/campaigns/CampaignLeadsDialog.tsx`

Alterar `handleSyncUrls` para:
1. Buscar a URL base da API da VPS a partir de `global_config` ou `api_configs`
2. Usar `supabase.functions.invoke('sync-invite-links')` como fallback
3. Tratar erros de forma mais amigavel

### Arquivo: `supabase/functions/sync-invite-links/index.ts`

Ajustar a resolucao da URL do Baileys:
- Se `whatsapp_provider === 'baileys'`, usar `baileys_api_url` da global_config (que pode ser o IP/dominio publico da VPS)
- Fallback para `http://baileys-server:3100` apenas se nao houver URL configurada

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| src/components/campaigns/CampaignLeadsDialog.tsx | Usar supabase.functions.invoke em vez de fetch direto |
| supabase/functions/sync-invite-links/index.ts | Melhorar resolucao da URL do Baileys |

