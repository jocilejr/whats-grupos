

# Instalador Automatico para VPS Ubuntu

## O que sera criado

Um script `install.sh` na raiz do projeto que, apos dar `git clone` e executar, faz toda a instalacao automaticamente: Supabase self-hosted (banco de dados, autenticacao, storage, edge functions), frontend buildado e Nginx com SSL.

## Como vai funcionar para o usuario

```text
git clone <seu-repositorio> whats-grupos
cd whats-grupos
chmod +x install.sh
sudo ./install.sh
```

O script vai perguntar interativamente apenas o necessario:
- Dominio (ex: `meusistema.com`)
- Email para o certificado SSL
- Senha do banco de dados (ou gera automaticamente)

Todo o resto e automatico.

---

## O que o instalador faz (passo a passo)

1. **Verifica e instala dependencias do sistema**: Docker, Docker Compose, Node.js 20, Nginx, Certbot
2. **Configura o Supabase self-hosted**:
   - Clona o repositorio `supabase/docker` em `/opt/supabase-docker`
   - Gera automaticamente JWT_SECRET, ANON_KEY e SERVICE_ROLE_KEY
   - Configura o `.env` do Supabase com as credenciais geradas
   - Sobe todos os containers (PostgreSQL, GoTrue, PostgREST, Storage, Edge Functions)
3. **Executa as migracoes do banco**: Roda todos os arquivos SQL da pasta `supabase/migrations/` em ordem cronologica
4. **Configura o cron job**: Cria o `pg_cron` schedule para disparar `send-scheduled-messages` a cada minuto
5. **Cria o bucket de storage**: O bucket `media` publico (ja incluso nas migracoes)
6. **Deploy das Edge Functions**: Copia e configura as funcoes `evolution-api` e `send-scheduled-messages` no runtime Deno do Supabase
7. **Builda o frontend**: Gera o `.env` com as URLs locais e executa `npm install && npm run build`
8. **Configura o Nginx**: Cria os virtual hosts para o frontend e proxy reverso da API
9. **Configura SSL**: Executa o Certbot automaticamente para gerar certificados HTTPS

---

## Arquivos a serem criados

### 1. `install.sh` (script principal)

O script principal com toda a logica de instalacao. Inclui:
- Funcoes auxiliares para log colorido e verificacao de erros
- Deteccao de sistema operacional (valida que e Ubuntu 22.04+)
- Geracao automatica de chaves JWT usando `openssl` e codificacao base64
- Todas as etapas listadas acima em sequencia

### 2. `nginx/frontend.conf.template`

Template de configuracao Nginx para o frontend, com placeholder `{{DOMAIN}}` substituido durante a instalacao:
- Serve os arquivos estaticos da pasta `dist/`
- Redireciona rotas do React para `index.html`
- Cache de assets estaticos

### 3. `nginx/api.conf.template`

Template de configuracao Nginx para proxy reverso da API Supabase:
- Proxy para `localhost:8000` (Kong/PostgREST)
- Headers de proxy corretos
- Suporte a WebSocket para realtime

### 4. `scripts/generate-keys.sh`

Script auxiliar que gera as chaves JWT (ANON_KEY e SERVICE_ROLE_KEY) a partir de um JWT_SECRET usando `openssl`. Essas chaves sao necessarias para o Supabase funcionar.

### 5. `scripts/run-migrations.sh`

Script que conecta ao PostgreSQL local e executa cada arquivo `.sql` da pasta `supabase/migrations/` em ordem alfabetica (cronologica).

### 6. `scripts/setup-cron.sh`

Script que configura o `pg_cron` job no banco local para chamar a edge function `send-scheduled-messages` a cada minuto.

---

## Estrutura final

```text
whats-grupos/
  install.sh              <- Script principal (executar este)
  scripts/
    generate-keys.sh      <- Gera JWT keys
    run-migrations.sh     <- Executa migracoes SQL
    setup-cron.sh         <- Configura pg_cron
  nginx/
    frontend.conf.template  <- Template Nginx frontend
    api.conf.template       <- Template Nginx API
  supabase/               <- (ja existente)
    migrations/
    functions/
  src/                    <- (ja existente)
  ...
```

---

## Detalhes tecnicos

### Geracao de chaves JWT

O Supabase requer um `JWT_SECRET` e duas chaves derivadas dele (ANON_KEY com role `anon` e SERVICE_ROLE_KEY com role `service_role`). O script gera o secret com `openssl rand -base64 32` e cria os JWTs usando um script Python embutido (ou `node` como fallback), evitando dependencias externas.

### Edge Functions no self-hosted

As edge functions serao deployadas usando o Supabase CLI (`supabase functions deploy`). O script instala o CLI automaticamente se nao estiver presente e faz o link com o projeto local.

### Proxy reverso

O Nginx sera configurado como proxy reverso para o Supabase Kong (porta 8000), que e o gateway unificado para PostgREST, GoTrue, Storage e Edge Functions. Assim, basta um unico subdominio `api.seudominio.com` para toda a API.

### Seguranca

- Todas as senhas e chaves sao geradas automaticamente com `openssl`
- O acesso direto ao PostgreSQL (porta 5432) nao e exposto externamente
- SSL via Certbot com renovacao automatica
- As politicas RLS do banco sao mantidas identicas

