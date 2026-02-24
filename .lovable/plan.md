

## Remover coluna URL da tabela e adicionar URL do GET

### O que muda

1. **Remover a coluna "URL"** (invite_url de cada grupo) da tabela de Leads -- foi adicionada no ultimo commit
2. **Adicionar uma segunda URL copiavel** acima da tabela, ao lado da URL principal de redirect, mostrando a URL do endpoint GET que retorna apenas texto

### Exemplo visual

A area de URLs ficara assim:

- URL de redirect: `https://app.simplificandogrupos.com/r/comunidade-rosana` (ja existe)
- URL do GET: `https://app.simplificandogrupos.com/r/comunidade-rosana-get` (nova)

Ambas com botao de copiar.

### Detalhes tecnicos

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx`

1. Remover `<TableHead className="w-44">URL</TableHead>` (linha 410)
2. Remover o bloco `<TableCell>` com inviteUrl e botao Copy (linhas 451-470)
3. Na secao "Public URL" (linhas 372-381), adicionar uma segunda linha mostrando a URL do GET, usando o padrao `slug + "-get"` como sufixo. Exemplo: `/r/comunidade-rosana` para redirect e `/r/comunidade-rosana-get` para o GET

A URL do GET apontara para a mesma rota do frontend (`/r/slug-get`) que o componente `SmartLinkRedirect` ja captura via `useParams`. O baileys-server na VPS tambem ja tem o endpoint `/smart-link/:slug` que pode ser chamado diretamente.

Como o endpoint GET roda no baileys-server da VPS (nao no frontend), a URL exibida sera construida usando a `baileys_api_url` da configuracao ou, mais simplesmente, usando o mesmo dominio com o sufixo `-get` no slug -- a mesma logica de redirect do frontend buscara esse slug separado.

**Abordagem mais simples:** Exibir a URL do GET como o endpoint do baileys-server diretamente. Mas como o usuario quer `www.site.com/r/slug-get`, vamos manter o padrao do frontend adicionando o sufixo `-get` ao slug na URL exibida.

