# Busca Automatica de Links de Convite via Baileys

## Resumo

Atualmente o dialog do Smart Link exige que o usuario cole manualmente o link de convite de cada grupo. A proposta e que o sistema busque automaticamente as URLs de convite dos grupos via Baileys (`sock.groupInviteCode`) e as armazene no banco. Grupos sem URL disponivel (ex: bot nao e admin) ficam indisponiveis para direcionamento. A sincronizacao ocorre a cada 15 minutos.  
  
Deve haver uma variação para POST (acessar a URL e ser redirecionado) e GET (um servidor buscar a URL disponível)

## Arquitetura

```text
[Cron 15min] --> [Edge Function: sync-invite-links]
                        |
                        v
              [Baileys Server: /group/inviteCode/:name/:jid]
                        |
                        v
              [DB: group_stats.invite_url]  <-- cache das URLs
                        |
                        v
              [Smart Link Redirect] --> usa invite_url do group_stats
              [CampaignLeadsDialog] --> exibe URLs (read-only)
```

## Mudancas

### 1. Baileys Server - Novo endpoint para buscar invite code

Adicionar endpoint `GET /group/inviteCode/:name/:jid` no `baileys-server/server.js`.

O Baileys oferece `sock.groupInviteCode(jid)` que retorna o codigo de convite. O endpoint retornara a URL completa `https://chat.whatsapp.com/{code}`.

Se o bot nao for admin do grupo, o Baileys lanca erro - o endpoint retornara `null` nesse caso.

Tambem adicionar um endpoint em lote `POST /group/inviteCodeBatch/:name` que recebe `{ jids: [...] }` e retorna um mapa `{ jid: url | null }` para otimizar a sincronizacao.

### 2. Migracao de banco - Coluna invite_url em group_stats

Adicionar coluna `invite_url text` na tabela `group_stats` para persistir as URLs obtidas. Isso permite que o redirect e o dialog consultem sem chamar o Baileys a cada requisicao.

### 3. Nova Edge Function - sync-invite-links

Cria `supabase/functions/sync-invite-links/index.ts` que:

- Busca todos os smart links ativos (`campaign_smart_links` onde `is_active = true`)
- Para cada smart link, identifica os group_ids associados
- Busca a instancia do usuario via `api_configs`
- Chama o endpoint batch do Baileys para obter os invite codes
- Atualiza `group_stats` com as invite_urls obtidas
- Atualiza `campaign_smart_links.group_links` com as novas URLs (removendo input manual)

A funcao nao requer autenticacao pois sera chamada pelo cron com service role.

### 4. Cron Job - A cada 15 minutos

Atualizar `scripts/setup-cron.sh` para adicionar um cron job que chama `sync-invite-links` a cada 15 minutos.

Tambem adicionar no `install.sh` e `deploy.sh` a nova edge function.

### 5. Smart Link Redirect - Usar invite_url do group_stats

Alterar `supabase/functions/smart-link-redirect/index.ts`:

- Em vez de ler `invite_url` do campo `group_links` do JSON, consultar `group_stats` para pegar `invite_url` mais recente
- Pular grupos onde `invite_url` e `null` (grupo indisponivel)
- So usar fallback para o ultimo grupo se ele tiver URL

### 6. UI - CampaignLeadsDialog

Alterar `src/components/campaigns/CampaignLeadsDialog.tsx`:

- Remover o campo `Input` de link de convite da tabela
- Exibir a URL buscada automaticamente como texto (read-only) com badge "Disponivel" / "Indisponivel"
- Grupos sem URL mostram badge vermelha "Sem permissao" (bot nao e admin)
- Adicionar botao "Sincronizar URLs agora" que chama a edge function manualmente
- Remover a logica de `updateInviteUrl` (nao e mais necessaria)
- Na hora de salvar, nao exigir mais `invite_url` preenchida (sera automatica)

### 7. Atualizacao do install.sh e deploy.sh

Adicionar `sync-invite-links` na lista de edge functions em ambos os scripts.

## Detalhes Tecnicos

### Endpoint Baileys (batch)

```text
POST /group/inviteCodeBatch/:name
Body: { "jids": ["123@g.us", "456@g.us"] }
Response: { "123@g.us": "https://chat.whatsapp.com/ABC", "456@g.us": null }
```

Internamente chama `sock.groupInviteCode(jid)` para cada JID, com try/catch individual (retorna null se falhar).

### Fluxo do sync-invite-links

1. Buscar todos `campaign_smart_links` ativos com service role
2. Extrair user_ids unicos
3. Para cada user, buscar `api_configs` ativas
4. Para cada config, chamar batch endpoint com os group_ids dos smart links daquele usuario
5. Upsert `group_stats` com invite_url
6. Atualizar `group_links` JSON no smart link com as URLs obtidas

### Migracao SQL

```text
ALTER TABLE public.group_stats ADD COLUMN IF NOT EXISTS invite_url text;
```

## Arquivos modificados


| Arquivo                                          | Acao                                             |
| ------------------------------------------------ | ------------------------------------------------ |
| baileys-server/server.js                         | Adicionar endpoints inviteCode e inviteCodeBatch |
| supabase/functions/sync-invite-links/index.ts    | Nova edge function                               |
| supabase/functions/smart-link-redirect/index.ts  | Usar invite_url do group_stats                   |
| src/components/campaigns/CampaignLeadsDialog.tsx | Remover input manual, exibir URLs automaticas    |
| scripts/setup-cron.sh                            | Adicionar cron job de 15 minutos                 |
| scripts/deploy.sh                                | Adicionar sync-invite-links                      |
| install.sh                                       | Adicionar sync-invite-links                      |
| Migracao SQL                                     | Adicionar coluna invite_url em group_stats       |
