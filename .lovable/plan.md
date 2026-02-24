
## Endpoint GET publico que retorna URL como texto puro

### O que faz
Nova edge function `smart-link-api` que recebe `?slug=xxx` e retorna **apenas a URL do grupo como texto plano** (content-type `text/plain`), sem JSON, sem redirect, sem registrar clique.

### Exemplo de uso
```
GET /functions/v1/smart-link-api?slug=meu-slug

Resposta: https://chat.whatsapp.com/ABC123
```

### Alteracoes

| Arquivo | Acao |
|---------|------|
| `supabase/functions/smart-link-api/index.ts` | Criar nova edge function |
| `supabase/config.toml` | Adicionar `verify_jwt = false` |

### Detalhes tecnicos

- Reutiliza a mesma logica de selecao de grupo do `smart-link-redirect` (ordenado por position, primeiro com vaga e invite_url valida, fallback pro ultimo com URL)
- Retorna `Content-Type: text/plain` com apenas a URL no body
- **Nao registra clique** na tabela `smart_link_clicks`
- Em caso de erro retorna texto simples com status HTTP apropriado (404, 500)
- CORS aberto, sem JWT, totalmente publico
