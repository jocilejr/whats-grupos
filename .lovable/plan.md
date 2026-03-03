

## Diagnóstico

Verifiquei o banco de dados:
- `vps_api_url` = `https://api.app.simplificandogrupos.com` (está preenchido)
- `baileys_api_key` = `""` (string vazia)

### Problema 1: Base URL mostrando localhost
O código busca `vps_api_url` corretamente, mas o `catch {}` vazio engole qualquer erro silenciosamente. Se a query falhar (ex: problema de RLS ou timing), o fallback `http://localhost:3100` é exibido. Vou melhorar o tratamento de erro e adicionar log.

### Problema 2: API Key não aparece
O campo `baileys_api_key` está vazio no banco. O código usa `{apiKey && (...)}`, então a seção fica invisível. Em vez de esconder, vou sempre mostrar a seção com um aviso para configurar quando estiver vazia.

### Alterações

**`src/pages/admin/AdminApiDocs.tsx`**:

1. Remover o `catch {}` vazio — adicionar `console.error` para debug
2. Sempre exibir a seção de API Key:
   - Se preenchida: mostrar mascarada com botões Mostrar/Copiar (como hoje)
   - Se vazia: mostrar alerta "Nenhuma API Key configurada. Defina em Config Global → API Key do Baileys Server"
3. Trocar o fallback de `http://localhost:3100` para mensagem "Não configurada" quando `baseUrl` estiver vazio

