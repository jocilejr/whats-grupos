

## Expor a URL do GET publicamente via rota `-get`

### Problema

Quando o usuario acessa `app.simplificandogrupos.com/r/comunidade-rosana-get`, o componente `SmartLinkRedirect` envia o slug completo `comunidade-rosana-get` para a edge function, que procura um smart link com esse slug exato no banco. Como o slug real e `comunidade-rosana`, retorna "Link not found or inactive".

### Solucao

Modificar o `SmartLinkRedirect` para detectar slugs terminados em `-get` e tratar de forma diferente:

1. Se o slug termina em `-get`, remover o sufixo e buscar o slug real
2. Em vez de redirecionar o usuario, exibir a URL em texto puro na pagina (para que sistemas externos possam fazer GET e obter a URL)

### Alteracao

**Arquivo:** `src/pages/SmartLinkRedirect.tsx`

1. No `useEffect`, verificar se o slug termina com `-get`
2. Se sim: remover o sufixo `-get`, chamar a edge function com o slug real, e em vez de fazer `window.location.href`, exibir a URL retornada como texto puro na tela (sem layout, sem estilo -- apenas o texto da URL como resposta)
3. Se nao: manter o comportamento atual de redirecionamento

### Comportamento esperado

- `/r/comunidade-rosana` -> redireciona o usuario para o grupo do WhatsApp (comportamento atual)
- `/r/comunidade-rosana-get` -> exibe apenas a URL do WhatsApp como texto puro na pagina, para que sistemas externos possam fazer fetch e obter a URL

### Detalhes tecnicos

- O componente detecta `-get` via `slug.endsWith("-get")`
- Remove o sufixo: `slug.slice(0, -4)` para obter o slug real
- Chama a mesma edge function `smart-link-redirect` com o slug real
- Em vez de redirecionar, renderiza apenas o texto da URL (sem HTML extra, usando `document.write` ou renderizando um elemento minimo com apenas a URL)
- Para que o response seja o mais limpo possivel para consumo por APIs externas, a pagina mostrara apenas a URL sem nenhum wrapper visual

