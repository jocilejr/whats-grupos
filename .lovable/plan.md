

## Problema

Dois bugs inter-relacionados:

1. **Erro "Unexpected token '<'"**: O botao "Sincronizar URLs agora" le `api_configs.api_url` que contem o valor `"global"` (nao e uma URL valida). O codigo transforma isso em uma URL relativa que resolve para o frontend HTML.

2. **Membros mostrando 0/1000**: A tabela `group_stats` esta completamente vazia. A funcao `sync-group-stats` precisa rodar na VPS (onde o Baileys esta acessivel), mas o frontend tenta chamar a versao do Lovable Cloud que nao consegue acessar o Baileys.

## Causa Raiz

O campo `api_configs.api_url` contem `"global"` em vez de uma URL real da VPS. As edge functions de sync precisam rodar na VPS, nao no Lovable Cloud, pois dependem do Baileys server na rede Docker interna.

## Solucao

Adicionar um campo `vps_api_url` na tabela `global_config` para armazenar a URL base da API da VPS (ex: `https://api.app.simplificandogrupos.com`). O frontend usara esse valor para chamar as edge functions de sync na VPS.

## Mudancas

### 1. Migracao de banco de dados

Adicionar coluna `vps_api_url` na tabela `global_config`:

```sql
ALTER TABLE global_config 
ADD COLUMN IF NOT EXISTS vps_api_url text NOT NULL DEFAULT '';
```

### 2. Atualizar `CampaignLeadsDialog.tsx` - funcao `handleSyncUrls`

Substituir a logica que le `api_configs.api_url` por uma que le `global_config.vps_api_url`:

```text
// Antes (bugado):
const { data: apiConfig } = await supabase
  .from("api_configs")
  .select("api_url")...
const vpsBase = apiConfig.api_url.replace(/\/rest\/?$/, "");

// Depois (corrigido):
const { data: globalCfg } = await supabase
  .from("global_config")
  .select("vps_api_url")
  .limit(1)
  .maybeSingle();
const vpsBase = globalCfg?.vps_api_url;
```

Se `vps_api_url` estiver vazio, mostrar um toast orientando o admin a configurar a URL da VPS nas configuracoes.

### 3. Atualizar `handleSyncUrls` para tambem chamar `sync-group-stats`

Apos chamar `sync-invite-links`, fazer uma segunda chamada para `sync-group-stats` na VPS para popular os dados de membros:

```text
// Chamar sync-group-stats na VPS tambem
await fetch(`${vpsBase}/functions/v1/sync-group-stats`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
});
```

### 4. Atualizar pagina de Configuracoes Admin (`AdminConfig.tsx`)

Adicionar campo para o admin configurar a `vps_api_url` na interface de configuracoes globais. Isso garante que o valor seja facilmente editavel sem acesso direto ao banco.

### 5. Configurar valor inicial

Inserir o valor `https://api.app.simplificandogrupos.com` na coluna `vps_api_url` da `global_config` via migracao.

## Secao Tecnica

- A arquitetura tem dois ambientes: Lovable Cloud (frontend + banco) e VPS (Baileys + Kong + edge functions locais)
- Edge functions que dependem do Baileys (`sync-group-stats`, `sync-invite-links`) precisam ser chamadas via VPS (`api.app.simplificandogrupos.com`)
- O campo `api_configs.api_url = "global"` indica que a configuracao usa valores globais em vez de URLs por instancia — o codigo precisa tratar esse caso
- A tabela `group_stats` vazia explica o "0 / 1000" em todos os grupos — ela sera populada quando `sync-group-stats` rodar com sucesso na VPS

