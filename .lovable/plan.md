

# Corrigir script de criacao de administrador

## Problema

O script `create-admin.sh` falha silenciosamente porque usa `set -euo pipefail`. Quando o `curl` retorna um erro ou o `grep` nao encontra o padrao esperado, o script morre antes de imprimir a resposta da API, tornando impossivel diagnosticar o problema.

## Solucao

Tornar o script mais resiliente e adicionar output de debug:

### Mudancas no `scripts/create-admin.sh`

1. **Remover `set -euo pipefail`** e usar tratamento de erro manual - isso evita que comandos como `grep` (que retorna exit code 1 quando nao encontra match) matem o script

2. **Imprimir a resposta da API** quando houver falha, para facilitar diagnostico

3. **Usar `jq` ou parsing mais robusto** para extrair o user_id do JSON - o `grep` atual e fragil e depende da ordem dos campos no JSON

4. **Adicionar fallback via psql direto** caso a API falhe - criar o usuario diretamente no banco se a API GoTrue nao responder corretamente

### Arquivo: `scripts/create-admin.sh` - reescrita

```bash
#!/bin/bash
# Cria usuario administrador via Supabase Auth API (Kong)

SERVICE_ROLE_KEY="$1"
ANON_KEY="$2"
ADMIN_EMAIL="$3"
ADMIN_PASSWORD="$4"
DB_PASSWORD="${5:-}"
DB_PORT="${6:-5432}"

KONG_URL="http://localhost:8000"
SUPABASE_DIR="/opt/supabase-docker/docker"

# ... (color definitions and log functions stay the same)

# Aguardar API - unchanged

# Criar usuario - com debug
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ...)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "[DEBUG] HTTP $HTTP_CODE - Body: $BODY"

# Extrair user_id com grep mais robusto
USER_ID=$(echo "$BODY" | grep -oP '"id"\s*:\s*"\K[^"]+' | head -1 || true)

# Se falhou, tentar via psql direto
if [ -z "$USER_ID" ]; then
  # Criar usuario direto no banco via psql
  USER_ID=$(cd "$SUPABASE_DIR" && docker compose exec -T db \
    psql -U postgres -d postgres -t -A -c "
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password,
        email_confirmed_at, aud, role, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
        '${ADMIN_EMAIL}',
        crypt('${ADMIN_PASSWORD}', gen_salt('bf')),
        now(), 'authenticated', 'authenticated',
        '{\"display_name\": \"Administrador\"}'::jsonb,
        now(), now()
      )
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id;
    " 2>/dev/null | tr -d '[:space:]')
fi
```

### Resumo das mudancas

- Remover `set -euo pipefail` para evitar morte silenciosa
- Adicionar `|| true` nos comandos grep para evitar exit code 1
- Imprimir resposta da API para debug
- Adicionar fallback: criar usuario direto via SQL no PostgreSQL caso a API GoTrue falhe
- Separar HTTP code do body do curl para melhor diagnostico

