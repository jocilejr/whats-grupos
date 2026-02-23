

# Corrigir process-queue para usar URL fixa do Baileys

## Problema

A funcao `process-queue/index.ts` e a responsavel por processar e enviar as mensagens da fila. Ela possui sua propria funcao `getProviderConfig` que ainda usa o codigo antigo:

```
apiUrl: (globalConfig.baileys_api_url || "http://localhost:3100")
```

Isso faz com que a mensagem fique presa como "Pendente" porque `localhost:3100` nao e acessivel de dentro do container da Edge Function. A URL correta e `http://baileys-server:3100` (nome DNS do container Docker na rede interna).

Apenas a edge function `evolution-api` foi atualizada anteriormente. A `process-queue`, que e a que de fato envia, ficou com o codigo antigo.

## Solucao

Atualizar a funcao `getProviderConfig` dentro de `supabase/functions/process-queue/index.ts` para usar a URL fixa `http://baileys-server:3100`, identico ao que ja foi feito na `evolution-api`.

## Detalhes Tecnicos

### Arquivo: `supabase/functions/process-queue/index.ts`

Alterar linhas 34-39 de:

```typescript
if (provider === "baileys") {
  return {
    provider: "baileys",
    apiUrl: (globalConfig.baileys_api_url || "http://localhost:3100").replace(/\/$/, ""),
    apiKey: "",
  };
}
```

Para:

```typescript
if (provider === "baileys") {
  return {
    provider: "baileys",
    apiUrl: "http://baileys-server:3100",
    apiKey: "",
  };
}
```

### Resultado esperado

Apos essa correcao, a funcao `process-queue` conseguira alcançar o container Baileys pela rede Docker interna e as mensagens pendentes serao enviadas normalmente.

Nenhuma outra alteracao e necessaria -- apenas essa linha estava impedindo o envio.

