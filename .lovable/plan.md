

# Remover campo de URL do Baileys e usar URL fixa automaticamente

## Resumo

O Baileys sempre roda como um container Docker chamado `baileys-server` na porta 3100, na mesma rede Docker do Supabase. Nao faz sentido pedir ao usuario para digitar a URL manualmente. A solucao e usar a URL `http://baileys-server:3100` de forma fixa no codigo, sem necessidade de configuracao.

## O que muda para o usuario

- Na aba "Baileys (Local)", o campo de URL sera removido
- Basta selecionar a aba Baileys e clicar em "Salvar Configuracao"
- O botao "Testar Conexao" continuara funcionando normalmente
- Uma mensagem informativa explicara que o Baileys e detectado automaticamente

## Detalhes Tecnicos

### 1. Edge Function `evolution-api/index.ts`

Alterar `getProviderConfig` para usar URL fixa quando o provider for Baileys:

```typescript
if (provider === "baileys") {
  return {
    provider: "baileys",
    apiUrl: "http://baileys-server:3100",
    headers: { "Content-Type": "application/json" },
  };
}
```

Isso ignora completamente o campo `baileys_api_url` do banco de dados, garantindo que a URL correta seja sempre usada.

### 2. Frontend `AdminConfig.tsx`

- Remover o campo `<Input>` da URL do Baileys
- Remover o estado `baileysUrl` (nao e mais necessario)
- Manter a mensagem informativa dizendo que o Baileys e detectado automaticamente na VPS
- Manter o botao "Testar Conexao" e o botao "Salvar Configuracao"

### 3. Migracao de banco de dados

Atualizar o valor padrao da coluna `baileys_api_url` para `http://baileys-server:3100` e atualizar registros existentes:

```sql
ALTER TABLE global_config 
  ALTER COLUMN baileys_api_url SET DEFAULT 'http://baileys-server:3100';

UPDATE global_config 
  SET baileys_api_url = 'http://baileys-server:3100';
```

### 4. Deploy script (`scripts/deploy.sh`)

Atualizar o comando de criacao do container Baileys para conecta-lo automaticamente a rede `supabase_default`, evitando o passo manual `docker network connect`:

```bash
docker run -d --name baileys-server --restart unless-stopped \
  --network supabase_default \
  -p 127.0.0.1:3100:3100 -v baileys-data:/data baileys-server
```

