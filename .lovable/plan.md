
Diagnóstico objetivo:

1) O erro do toast (`Could not find function public.set_admin_global_config... in the schema cache`) é um problema de cache do PostgREST após criação/alteração de função SQL.  
2) Existe um segundo problema paralelo no `/admin/api-docs`: falha de import dinâmico (`Failed to fetch dynamically imported module`), porque a URL do módulo está retornando tela de login em vez de JS (não é erro de sintaxe do arquivo).

Plano de implementação (curto e direto):

1. Banco de dados (correção definitiva do RPC)
- Criar uma nova migração com:
  - `NOTIFY pgrst, 'reload schema';`
  - opcionalmente `NOTIFY pgrst, 'reload config';` (quando suportado)
- Confirmar por query que `public.set_admin_global_config(_openai_api_key text, _baileys_api_key text)` está visível.
- Se necessário, reaplicar `CREATE OR REPLACE FUNCTION` + `NOTIFY` no mesmo migration para forçar atualização atômica.

2. Frontend AdminConfig (resiliência do save)
- Manter uso de `baileys_api_url` vindo do backend (sem campo editável de URL).
- No `save.mutate`, tratar especificamente erro de schema cache:
  - exibir mensagem orientativa clara (“cache de schema em atualização, tente novamente em alguns segundos”).
  - evitar mensagem técnica crua para usuário final.
- Garantir que a API key manual (`baileys_api_key`) continue sendo a chave padrão para requisições externas.

3. Frontend AdminApiDocs (estabilidade de carregamento)
- Manter leitura via `get_admin_global_config`.
- Para eliminar o erro recorrente de import dinâmico no ambiente atual:
  - trocar `AdminApiDocs` de lazy import para import estático em `App.tsx` (somente para rota admin/docs), evitando fetch tardio do módulo.
- Isso reduz risco de quebrar a tela por sessão/autorização de asset no domínio de preview.

4. Verificação pós-fix (obrigatória)
- Fluxo 1: abrir `/admin/config`, salvar API key, confirmar toast de sucesso.
- Fluxo 2: abrir `/admin/api-docs`, confirmar:
  - Base URL = `baileys_api_url` do backend
  - API key exibida = valor salvo em Config Global
- Fluxo 3: copiar cURL e validar que usa a chave padrão no header `apikey`.

Detalhes técnicos (sem jargão desnecessário):
- A função existe no banco; o problema é a camada HTTP não enxergar imediatamente mudanças de função (cache de schema).
- O erro de “dynamic import” não indica bug no JSX da página; indica resposta incorreta da URL do módulo no momento do carregamento lazy.
- Não vamos reintroduzir campo de URL manual: a fonte oficial continua sendo `global_config.baileys_api_url`.
