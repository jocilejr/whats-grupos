

# Corrigir Integração do Baileys

## Problema Identificado

Existem dois problemas com o Baileys:

1. **Botão "Testar Conexão" no frontend**: O codigo faz um `fetch` direto do navegador para `http://localhost:3100/health`. Como o navegador roda na maquina do usuario (nao na VPS), a conexao e recusada (`ERR_CONNECTION_REFUSED`).

2. **Edge Functions vs Docker**: As Edge Functions rodam dentro do container `supabase-edge-functions`. Elas tentam acessar `http://localhost:3100`, mas `localhost` dentro desse container nao aponta para o container do Baileys. E preciso usar o nome do servico Docker ou o IP da rede Docker.

## Solucao

### 1. Adicionar acao `healthCheck` na Edge Function `evolution-api`

Adicionar um novo case `healthCheck` na edge function que faz o health check server-side (do container para o Baileys), retornando o resultado para o frontend.

### 2. Alterar `AdminConfig.tsx` - Testar Conexao via Edge Function

Em vez de fazer `fetch` direto do navegador, o botao "Testar Conexao" do Baileys vai chamar a edge function `evolution-api` com `action=healthCheck`, que por sua vez acessa o Baileys server-side.

### 3. Orientacao de infraestrutura (VPS)

O container do Baileys precisa estar na mesma rede Docker do Supabase. O usuario precisara:

- Adicionar o servico `baileys` no `docker-compose.yml` do Supabase (ou em um compose separado com a mesma rede)
- Usar o nome do servico Docker como URL (ex: `http://baileys:3100` em vez de `http://localhost:3100`)
- Atualizar o campo "URL do Servidor Baileys" na Config Global para `http://baileys:3100`

---

## Detalhes Tecnicos

### Edge Function `evolution-api/index.ts`

Adicionar case no switch:

```typescript
case "healthCheck": {
  try {
    const healthUrl = `${apiUrl}/health`;
    const resp = await fetch(healthUrl, { headers });
    const data = await resp.json();
    result = { status: "ok", ...data };
  } catch (e: any) {
    result = { status: "error", error: e.message };
  }
  break;
}
```

### `AdminConfig.tsx`

Substituir a funcao `testBaileys` para usar a edge function em vez de fetch direto:

```typescript
const testBaileys = async () => {
  setTestingBaileys(true);
  try {
    const { data, error } = await supabase.functions.invoke("evolution-api", {
      body: null,
      headers: { "Content-Type": "application/json" },
    });
    // Use query params via URL approach or pass action in body
    // ...check response
  } catch (e: any) {
    toast({ title: "Erro de conexao", description: e.message, variant: "destructive" });
  } finally {
    setTestingBaileys(false);
  }
};
```

Como a edge function `evolution-api` usa query params e exige `configId`, vamos criar uma abordagem que permita health check sem configId (usando diretamente a `global_config`).

### Alteracoes necessarias na Edge Function

Permitir que a acao `healthCheck` funcione sem `configId`, pois e um teste de infraestrutura (nao precisa de instancia de usuario):

```typescript
// Mover a verificacao de configId para depois do healthCheck
if (action === "healthCheck") {
  const globalConfig = await getGlobalConfig(supabase);
  if (!globalConfig) return json({ error: "Provider not configured" }, 500);
  const { apiUrl } = getProviderConfig(globalConfig);
  try {
    const resp = await fetch(`${apiUrl}/health`);
    result = await resp.json();
  } catch (e: any) {
    return json({ status: "error", error: e.message }, 500);
  }
  return json(result);
}
```

### Instrucao para o usuario na VPS

Apos a implementacao, o usuario precisara:

1. Verificar que o container Baileys esta na mesma rede Docker que o Supabase
2. Atualizar a URL do Baileys para usar o nome do servico Docker (ex: `http://baileys:3100`)
3. Ou, se preferir manter em compose separado, conectar ambos a mesma rede Docker

