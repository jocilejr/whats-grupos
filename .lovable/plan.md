
# Correção: Edge Function `evolution-api` não deployada

## Problema Identificado

A edge function `evolution-api` existe no código (`supabase/functions/evolution-api/index.ts`), mas **nao esta registrada** no arquivo de configuracao `config.toml`. Isso significa que ela nao esta sendo deployada, e todas as chamadas do frontend (pagina de Settings, teste de conexao, QR Code, etc.) falham com erro.

O request de rede confirma: ao chamar `connectionState` pela pagina de Settings, o resultado e `Failed to fetch`.

## Causa dos Erros

1. **Erro na pagina de Settings**: A edge function `evolution-api` nao existe no deploy, entao qualquer chamada retorna 404/falha
2. **Erro "Connection Closed" na fila**: A `process-queue` chama a Evolution API diretamente (sem passar pela edge function), e a API retorna erro 500. Isso e um problema temporario da instancia WhatsApp no lado da Evolution API. Apos corrigir o deploy, voce podera reprocessar as mensagens com erro.

## Plano de Correcao

### Passo 1: Registrar a edge function no config.toml
Adicionar a entrada `[functions.evolution-api]` com `verify_jwt = false` no `supabase/config.toml` para que a funcao seja deployada automaticamente.

### Passo 2: Adicionar funcao `admin-api` ao config.toml
Verificar se `admin-api` tambem precisa ser registrada (ela existe no codigo mas tambem nao esta no config.toml).

### Passo 3: Reprocessar mensagens com erro
Apos o deploy, atualizar as mensagens com status `error` na fila para `pending`, permitindo que sejam reenviadas automaticamente.

## Detalhes Tecnicos

Arquivo modificado: `supabase/config.toml`

Adicionar:
```toml
[functions.evolution-api]
verify_jwt = false

[functions.admin-api]
verify_jwt = false
```

SQL para reprocessar mensagens com erro:
```sql
UPDATE message_queue 
SET status = 'pending', error_message = NULL, started_at = NULL, completed_at = NULL 
WHERE status = 'error' 
AND created_at > now() - interval '1 day';
```
