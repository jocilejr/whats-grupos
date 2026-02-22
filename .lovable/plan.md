
# Plano: Reinstalacao Completa com Criacao de Admin

## Problema Atual
O instalador atual tem falhas criticas:
1. Nao pede email/senha do administrador durante a instalacao
2. Nao cria o usuario admin no Supabase Auth apos o setup
3. O problema de senhas desincronizadas entre o `.env` do Supabase e os usuarios internos do PostgreSQL (`supabase_admin`, `authenticator`, etc.) nao e tratado
4. Apenas 2 das 6 edge functions sao copiadas para o self-hosted

## O Que Sera Feito

### 1. Adicionar campo de Email e Senha do Admin na instalacao
Na secao de "Perguntas interativas" do `install.sh`, adicionar:
- `read -p "Email do administrador: " ADMIN_EMAIL`
- `read -sp "Senha do administrador: " ADMIN_PASSWORD` (com validacao de minimo 6 caracteres)

### 2. Criar script `scripts/create-admin.sh`
Novo script que sera executado apos as migracoes e apos o Supabase Auth estar rodando. Ele vai:
- Usar a API REST do GoTrue (servico `auth` do Supabase) para criar o usuario admin diretamente
- Chamar `POST http://localhost:9999/admin/users` (porta interna do GoTrue) com `SERVICE_ROLE_KEY`
- Alternativamente, usar `psql` para inserir diretamente na tabela `auth.users` com hash bcrypt da senha
- Inserir o role `admin` na tabela `user_roles`
- Inserir o plano ilimitado na tabela `user_plans`

A abordagem escolhida sera via API do Kong (`localhost:8000/auth/v1/admin/users`) usando o `SERVICE_ROLE_KEY`, que e o metodo mais seguro e compativel.

### 3. Corrigir problema de senhas do PostgreSQL
Adicionar ao instalador, apos o `docker compose up -d`:
- Aguardar o DB ficar healthy
- Editar `pg_hba.conf` dentro do container para `local all all trust`
- Reiniciar o container do DB
- Executar `ALTER USER` para todos os usuarios internos (`supabase_admin`, `supabase_auth_admin`, `authenticator`, `supabase_storage_admin`, `postgres`) com a senha do `.env`
- Restaurar o `pg_hba.conf` original
- Reiniciar o container do DB novamente

### 4. Copiar TODAS as edge functions
Atualizar o passo 6 para copiar todas as 6 funcoes:
- `evolution-api`
- `send-scheduled-messages`
- `admin-api`
- `backup-export`
- `generate-ai-message`
- `process-queue`

### 5. Expor porta 8000 do Kong para chamadas internas
A porta do Kong precisa estar acessivel (pelo menos no localhost) para que o script de criacao do admin funcione e para o cron job. O instalador atualmente comenta a porta - sera ajustado para expor apenas em `127.0.0.1:8000`.

## Novo Fluxo da Instalacao (9 passos)

```text
1/9 - Instalar dependencias do sistema
2/9 - Configurar Supabase Self-Hosted
3/9 - Corrigir senhas internas do PostgreSQL  <-- NOVO
4/9 - Executar migracoes do banco
5/9 - Habilitar extensoes (pg_cron, pg_net)
6/9 - Configurar cron job
7/9 - Deploy das Edge Functions (todas as 6)
8/9 - Criar conta administrador              <-- NOVO
9/9 - Buildar frontend + proxy reverso
```

## Detalhes Tecnicos

### Novo script `scripts/create-admin.sh`
```bash
#!/bin/bash
# Cria usuario admin via Supabase Auth API
# Uso: ./create-admin.sh <api_domain_or_localhost> <service_role_key> <email> <password>

# 1. Criar usuario via GoTrue Admin API
curl -s -X POST "http://localhost:8000/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"...","email_confirm":true}'

# 2. Obter user_id da resposta
# 3. INSERT INTO user_roles (admin)
# 4. INSERT INTO user_plans (ilimitado)
```

### Fix de senhas no `install.sh` (novo passo 3)
```bash
# Editar pg_hba.conf para trust
docker compose exec -T db bash -c \
  "cp /var/lib/postgresql/data/pg_hba.conf /var/lib/postgresql/data/pg_hba.conf.bak && \
   echo 'local all all trust' > /tmp/hba.conf && \
   cat /var/lib/postgresql/data/pg_hba.conf >> /tmp/hba.conf && \
   cp /tmp/hba.conf /var/lib/postgresql/data/pg_hba.conf"

# Reiniciar DB para aplicar
docker compose restart db && sleep 15

# Corrigir senhas
for USER in supabase_admin supabase_auth_admin authenticator supabase_storage_admin postgres; do
  docker compose exec -T db psql -U supabase_admin -d postgres \
    -c "ALTER USER ${USER} WITH PASSWORD '${POSTGRES_PASSWORD}';"
done

# Restaurar pg_hba.conf e reiniciar
docker compose exec -T db bash -c \
  "cp /var/lib/postgresql/data/pg_hba.conf.bak /var/lib/postgresql/data/pg_hba.conf"
docker compose restart db && sleep 15
```

### Perguntas interativas atualizadas
```text
- Dominio
- Email SSL (se nao Traefik)
- Senha do banco (Enter = auto)
- Email do administrador       <-- NOVO
- Senha do administrador       <-- NOVO
- Confirmacao
```

## Arquivos Modificados
1. **install.sh** - Perguntas do admin, fix de senhas, deploy de todas as functions, chamada do create-admin.sh
2. **scripts/create-admin.sh** - Novo script para criar usuario admin via API
3. **scripts/run-migrations.sh** - Sem alteracoes necessarias

## Resultado Final
Apos executar `sudo ./install.sh`, o sistema estara 100% funcional com:
- Todos os servicos healthy
- Conta admin criada e pronta para login
- Todas as edge functions deployadas
- Senhas do PostgreSQL sincronizadas corretamente
