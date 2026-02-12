

# Corrigir erro de CORS no Supabase Self-Hosted via Traefik

## Problema

O frontend em `https://app.simplificandogrupos.com` faz requisicoes para `https://api.app.simplificandogrupos.com` (Supabase self-hosted). O navegador bloqueia essas requisicoes porque o servidor nao retorna os headers CORS necessarios (`Access-Control-Allow-Origin`).

## Causa

O Traefik repassa as requisicoes para o Kong (porta 8000), mas nao adiciona headers CORS. O Kong do Supabase self-hosted pode nao estar configurado para aceitar requisicoes da origem do frontend.

## Solucao

Adicionar um middleware CORS na configuracao dinamica do Traefik (`traefik/supabase-api.yml`), que e o ponto mais simples e confiavel para resolver.

## Alteracoes

### 1. `traefik/supabase-api.yml`

Adicionar middleware de CORS que permite requisicoes do frontend:

```yaml
http:
  middlewares:
    cors-supabase:
      headers:
        accessControlAllowOriginList:
          - "https://{{FRONTEND_DOMAIN}}"
        accessControlAllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - PATCH
          - OPTIONS
        accessControlAllowHeaders:
          - Authorization
          - Content-Type
          - apikey
          - x-client-info
          - x-supabase-client-platform
          - x-supabase-client-platform-version
          - x-supabase-client-runtime
          - x-supabase-client-runtime-version
        accessControlAllowCredentials: true
        accessControlMaxAge: 3600

  routers:
    supabase-api:
      rule: "Host(`{{API_DOMAIN}}`)"
      entryPoints:
        - websecure
      service: supabase-kong
      middlewares:
        - cors-supabase
      tls:
        certResolver: "{{CERT_RESOLVER}}"

  services:
    supabase-kong:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:8000"
```

### 2. `install.sh`

Atualizar o bloco de `sed` que substitui placeholders no `supabase-api.yml` para tambem substituir `{{FRONTEND_DOMAIN}}` pelo dominio correto (ex: `app.simplificandogrupos.com`).

### 3. `scripts/deploy.sh`

Adicionar a mesma substituicao de `{{FRONTEND_DOMAIN}}` e re-copiar o arquivo para o Traefik durante redeploys.

## Apos implementar

Voce precisara executar no servidor:

```bash
cd /root/whats-grupos
git pull
# Recopiar a config atualizada para o Traefik
docker cp traefik/supabase-api.yml $(docker ps -q -f name=traefik):/etc/traefik/dynamic/supabase-api.yml
```

O Traefik detecta mudancas automaticamente (file watch esta ativo), entao nao precisa reiniciar.

