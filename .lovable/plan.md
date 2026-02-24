

## Corrigir 3 problemas do Smart Link

### 1. Apenas 10 de 15 grupos com invite URL

O problema esta na funcao `sync-invite-links`. Ela roda no Lovable Cloud, mas o Baileys server esta na VPS (acessivel apenas via rede Docker interna `http://baileys-server:3100`). O fallback no codigo forca esse endereco interno, que nao e acessivel a partir do Lovable Cloud.

Na VPS o mesmo problema ocorre se o `baileys_api_url` no `global_config` estiver configurado como o endereco interno Docker. A funcao precisa usar o endereco correto para alcançar o Baileys.

Porem, como a funcao ja retornou `"No active smart links"` (tabela vazia no Cloud), o sync de fato so roda na VPS. O erro de "Sem permissao" mostrado na UI vem do fato de que o `invite_url` esta vazio no `group_stats` para esses 5 grupos. Isso pode significar que o endpoint batch do Baileys retornou `null` para esses grupos.

**Correcao:** Adicionar logs detalhados na `sync-invite-links` para registrar quais grupos retornaram `null` do Baileys, e tratar o caso em que o Baileys retorna erro parcial (alguns grupos com URL, outros sem). Tambem exibir na UI a mensagem correta: "Sem URL" em vez de "Sem permissao", ja que o bot pode ser admin mas o Baileys falhou por outro motivo.

**Arquivo:** `supabase/functions/sync-invite-links/index.ts`
- Adicionar log com `console.log` mostrando a resposta bruta do Baileys
- Retornar no response os `group_ids` que falharam (sem URL)

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx`
- Mudar label de "Sem permissao" para "Sem link" (mais generico e correto)

---

### 2. Pagina de redirecionamento nao funciona

O `SmartLinkRedirect.tsx` constroi a URL usando `VITE_SUPABASE_PROJECT_ID`, que aponta para o Lovable Cloud (`wkixerhufxvcmegorjqc.supabase.co`). Na VPS, a tabela `campaign_smart_links` esta vazia no Cloud, entao o redirect sempre falha.

**Correcao:** Usar `VITE_SUPABASE_URL` que na VPS aponta para `https://api.app.simplificandogrupos.com`.

**Arquivo:** `src/pages/SmartLinkRedirect.tsx`

Trocar:
```typescript
const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const res = await fetch(
  `https://${projectId}.supabase.co/functions/v1/smart-link-redirect?slug=${encodeURIComponent(slug)}`
);
```

Por:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const res = await fetch(
  `${supabaseUrl}/functions/v1/smart-link-redirect?slug=${encodeURIComponent(slug)}`
);
```

---

### 3. Indicador de "grupo ativo" (para qual grupo o link redireciona)

Nao ha indicacao visual de qual grupo e o alvo atual do redirecionamento.

**Correcao:** Adicionar badge "Ativo" na tabela do `CampaignLeadsDialog.tsx`.

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx`

A logica e a mesma do edge function `smart-link-redirect`:
- Percorrer `groupLinks` em ordem de `position`
- O primeiro grupo que tem `invite_url` valida E `member_count < maxMembers` recebe o badge verde "Ativo"
- Adicionar uma coluna "Direcionamento" ou usar o badge na coluna do nome

---

### Resumo de arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/SmartLinkRedirect.tsx` | Trocar `VITE_SUPABASE_PROJECT_ID` por `VITE_SUPABASE_URL` |
| `src/components/campaigns/CampaignLeadsDialog.tsx` | Adicionar badge "Ativo" no grupo-alvo; mudar "Sem permissao" para "Sem link" |
| `supabase/functions/sync-invite-links/index.ts` | Adicionar logs detalhados da resposta do Baileys e retornar grupos sem URL no response |

Nenhuma alteracao de banco de dados necessaria.

