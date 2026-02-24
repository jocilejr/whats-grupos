## Corrigir CORS no redirecionamento e overflow na UI

### Problema 1: CORS bloqueia o redirecionamento

**Causa raiz:** O frontend faz `fetch()` (GET) para o edge function. O edge function retorna `302 redirect` para `https://chat.whatsapp.com/...`. O `fetch()` do browser segue o redirect automaticamente e tenta acessar o WhatsApp, que nao tem headers CORS -- resultado: bloqueado.

**Correcao:** Remover a logica de `302` do edge function. Sempre retornar JSON com `redirect_url`, independente do metodo HTTP. O frontend ja trata isso corretamente com `window.location.href = json.redirect_url`.

**Arquivo:** `supabase/functions/smart-link-redirect/index.ts`

- Remover o bloco `if (req.method === "GET") { return 302 }` (linhas 131-136)
- Sempre retornar JSON com `redirect_url`

---

### Problema 2: Tabela e URLs saindo da caixa do dialog

**Causa raiz:** A coluna "Status do Link" mostra a URL completa do WhatsApp (`https://chat.whatsapp.com/...`) ao lado do badge "Disponivel". Mesmo com `truncate` e `max-w-[150px]`, o layout nao tem `overflow-hidden` no container da tabela, e a tabela nao tem `table-fixed` para respeitar as larguras.

**Correcao no arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx`

- Remover a exibicao da URL completa na coluna "Status do Link" (manter apenas o badge "Disponivel" ou "Sem link")
- Adicionar `overflow-x-auto` no container da tabela
- Adicionar `table-layout: fixed` na tabela para respeitar larguras das colunas  
  
  
CORRIGIR O PROBLEMA DE NÃO ESTAR BUSCANDO TODAS AS URL DE TODOS OS GRUPOS. APENAS 10 DOS 15 GRUPOS ESTÃO COM URL DISPONÍVEIS.

---

### Resumo de alteracoes


| Arquivo                                            | Alteracao                                                   |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `supabase/functions/smart-link-redirect/index.ts`  | Remover 302 redirect; sempre retornar JSON                  |
| `src/components/campaigns/CampaignLeadsDialog.tsx` | Remover URL inline; adicionar overflow-x-auto e table-fixed |
