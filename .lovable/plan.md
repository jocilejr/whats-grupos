

## Problema: smart-link-api nao acessivel na VPS

A edge function `smart-link-api` foi deployada no Lovable Cloud, mas seus dados (tabela `campaign_smart_links`, `group_stats`) estao no Supabase self-hosted da VPS. Por isso a funcao nao encontra os smart links -- ela consulta o banco do Cloud, que esta vazio.

### Solucao: Expor via Baileys Server na VPS

Como todas as outras funcoes da VPS rodam no Supabase self-hosted, a melhor abordagem e criar um endpoint GET diretamente no **Baileys Server** (Express.js que ja roda na VPS), replicando a mesma logica.

### Alteracao

**Arquivo:** `baileys-server/server.js`

Adicionar um endpoint GET simples:

```
GET /smart-link/:slug
```

Que faz:
1. Conecta ao Supabase self-hosted da VPS (usando as env vars `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` que o Baileys server ja tem acesso)
2. Busca o smart link pelo slug na tabela `campaign_smart_links`
3. Busca os `group_stats` mais recentes para os grupos do smart link
4. Aplica a mesma logica de selecao (por position, com verificacao de capacidade)
5. Retorna a URL do grupo como `text/plain`

### Exemplo de uso

```
GET https://seu-dominio:porta/smart-link/comunidade-rosana

Resposta (text/plain): https://chat.whatsapp.com/ABC123
```

### Passos

1. Verificar as env vars disponiveis no Baileys server (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
2. Adicionar o endpoint `/smart-link/:slug` no `baileys-server/server.js`
3. Logica identica a da edge function: buscar smart link ativo, ordenar groups por position, retornar primeira URL com vaga
4. Retornar `Content-Type: text/plain` com apenas a URL
5. Em caso de erro retornar status HTTP apropriado (400, 404, 500)

### Vantagem

- Roda diretamente na VPS, acessivel pelo mesmo dominio/porta do Baileys
- Usa o banco de dados local (self-hosted) onde estao os dados reais
- Nao depende do Lovable Cloud para requisicoes externas

