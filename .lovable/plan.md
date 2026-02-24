

## Remover os "..." do modo GET no SmartLinkRedirect

### Problema

No modo GET (`/r/slug-get`), enquanto a requisicao esta em andamento, o componente renderiza `...` como placeholder. Sistemas externos que fazem fetch dessa URL capturam os 3 pontinhos como resposta antes da URL real carregar.

### Solucao

**Arquivo:** `src/pages/SmartLinkRedirect.tsx`

Alterar o bloco de renderizacao do modo GET para retornar uma string vazia (ou nada) enquanto a URL ainda nao foi carregada, em vez de `...`.

Mudanca na linha 43:
- De: `return <>...</>;`
- Para: `return null;`

Assim, enquanto a URL nao chega, a pagina fica em branco. Quando chegar, exibe apenas a URL pura.

