

# Adicionar Token OpenAI nas Configuracoes Globais

## Resumo

Adicionar um campo para a **API Key da OpenAI** na tabela `global_config` e na pagina de configuracao do admin. A edge function `generate-ai-message` usara essa chave diretamente da tabela (via service role), sem que usuarios comuns tenham acesso.

## O que muda

### 1. Banco de Dados
- Adicionar coluna `openai_api_key` (text, default `''`) na tabela `global_config`
- A RLS existente ja protege: somente admins podem ler/modificar `global_config`

### 2. Pagina Admin Config (`src/pages/admin/AdminConfig.tsx`)
- Adicionar um novo card "OpenAI / Inteligencia Artificial" abaixo do card da Evolution API
- Campo de input (type=password) para a API Key da OpenAI
- Botao "Testar Conexao" que faz uma chamada simples a API da OpenAI para validar a chave
- Salva junto com os demais campos no `global_config`

### 3. Edge Function `generate-ai-message`
- Em vez de usar `LOVABLE_API_KEY` + Lovable AI Gateway, busca a `openai_api_key` da tabela `global_config` via service role
- Chama diretamente `https://api.openai.com/v1/chat/completions` com o modelo desejado (ex: `gpt-4o-mini`)
- Usuarios nao tem acesso a chave -- ela so e lida no backend

### 4. Edge Function `send-scheduled-messages`
- Ao processar mensagens tipo "ai", chama `generate-ai-message` que internamente usa a chave da `global_config`
- Sem mudancas na logica -- a chave e transparente para o fluxo

## Seguranca

- A chave OpenAI fica na tabela `global_config`, protegida por RLS (somente admin)
- Edge functions acessam via `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS)
- Usuarios comuns nao tem nenhuma forma de ler essa informacao

## Detalhes Tecnicos

### Migracao SQL

```text
ALTER TABLE global_config ADD COLUMN openai_api_key text NOT NULL DEFAULT '';
```

### Arquivos modificados

| Arquivo | Acao |
|---------|------|
| `src/pages/admin/AdminConfig.tsx` | Adicionar campo OpenAI API Key + teste |
| `supabase/functions/generate-ai-message/index.ts` | Criar -- usa chave da global_config em vez do Lovable AI |
| `supabase/config.toml` | Registrar nova edge function |

### Fluxo da edge function `generate-ai-message`

```text
1. Recebe { prompt } no body
2. Cria cliente Supabase com service role
3. Busca openai_api_key da tabela global_config
4. Chama api.openai.com/v1/chat/completions
5. Retorna { text } gerado
```

### AdminConfig.tsx -- novo card

- State: `openaiKey`
- Teste: POST para `https://api.openai.com/v1/models` com header `Authorization: Bearer <key>` -- se retornar 200, chave valida
- Salva no campo `openai_api_key` do `global_config` junto com os campos da Evolution API
