

## Plano: Corrigir Base URL dos Endpoints

### Problema
A página busca `baileys_api_url` do `global_config`, que contém a URL interna Docker (`http://baileys-server:3100`). Para integrações externas, deve usar `vps_api_url`.

### Alteração

**Arquivo: `src/pages/admin/AdminApiDocs.tsx`**

1. Na função `loadData()` (linha 203): trocar `.select("baileys_api_url")` por `.select("vps_api_url")`
2. Linha 206-208: ler `config?.vps_api_url` em vez de `config?.baileys_api_url`
3. Linha 317/319: atualizar o fallback e o texto explicativo para referenciar "Config Global → URL da API da VPS"

Resultado: os cURLs e a Base URL exibida usarão a URL pública (ex: `https://api.app.simplificandogrupos.com`).

