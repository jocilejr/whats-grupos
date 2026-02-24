

## Corrigir CORS na URL de Retorno (GET)

### Problema

A URL de Retorno (`/r/slug-get`) aponta para uma pagina React (SPA). Quando um sistema externo (como `grupo.comunidademeire.online`) tenta fazer fetch dessa URL, o navegador bloqueia por CORS porque o servidor web (nginx) nao envia headers `Access-Control-Allow-Origin` para paginas do frontend.

### Causa raiz

Uma pagina React nao e um endpoint de API -- ela retorna HTML sem headers CORS. Para sistemas externos consumirem uma URL via fetch/AJAX, precisa ser um endpoint servidor com headers CORS adequados.

### Solucao

Ja existe uma edge function `smart-link-api` que faz exatamente isso: recebe o slug, encontra o grupo disponivel, e retorna a URL como texto puro COM headers CORS. A solucao e simplesmente apontar a "URL de Retorno (Texto)" para essa edge function em vez da rota do frontend.

### Alteracao

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx`

1. Construir a URL do GET apontando para a edge function `smart-link-api` em vez do frontend:
   - De: `{publicUrl}-get` (ex: `https://app.simplificandogrupos.com/r/comunidade-rosana-get`)
   - Para: `https://{SUPABASE_URL}/functions/v1/smart-link-api?slug={slug}` (ex: usando `import.meta.env.VITE_SUPABASE_URL`)

2. Atualizar o botao de copiar para usar a mesma URL da edge function

A edge function `smart-link-api` ja esta configurada com `verify_jwt = false` e inclui headers CORS, entao funcionara perfeitamente para chamadas de sistemas externos.

### Resultado esperado

- URL de Redirecionamento: `https://app.simplificandogrupos.com/r/comunidade-rosana` (sem mudanca)
- URL de Retorno (Texto): `https://wkixerhufxvcmegorjqc.supabase.co/functions/v1/smart-link-api?slug=comunidade-rosana` (endpoint com CORS)

Sistemas externos poderao fazer fetch dessa URL sem erro de CORS e receberao a URL do grupo como texto puro.

