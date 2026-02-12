

# Corrigir configuracao do Traefik com valores reais do servidor

## Problema

Os arquivos criados anteriormente usam valores padrao que nao correspondem a configuracao real do Traefik no servidor:

- Rede: `traefik_public` deveria ser `traefik-public`
- Cert resolver: `letsencrypt` deveria ser `letsencryptresolver`
- O file provider do Traefik esta em `/etc/traefik/dynamic` (dentro do container, mapeado via volume)

## Alteracoes

### 1. `docker-compose.frontend.yml`

Corrigir:
- Nome da rede de `traefik_public` para `traefik-public`
- Cert resolver de `letsencrypt` para `letsencryptresolver`
- Usar variaveis de ambiente com defaults corretos

### 2. `traefik/supabase-api.yml`

Corrigir o placeholder do cert resolver para usar `letsencryptresolver` como default.

### 3. `install.sh`

Corrigir:
- Default do `CERT_RESOLVER` para `letsencryptresolver`
- Default do `TRAEFIK_NETWORK` para `traefik-public`
- Caminho do file provider: o script precisa copiar o arquivo de rota da API para dentro do volume do Traefik (nao para um diretorio do host). Identificar o volume correto e copiar via `docker cp`.

### 4. `scripts/deploy.sh`

Corrigir os defaults das variaveis:
- `TRAEFIK_NETWORK` para `traefik-public`
- `CERT_RESOLVER` para `letsencryptresolver`

## Detalhe tecnico sobre o File Provider

O Traefik usa `--providers.file.directory=/etc/traefik/dynamic` que e um caminho **dentro do container**. Para injetar a configuracao da API, o `install.sh` precisa:

1. Encontrar o container do Traefik
2. Usar `docker cp` para copiar o arquivo `supabase-api.yml` para `/etc/traefik/dynamic/` dentro do container

Alternativamente, se o diretorio `/etc/traefik/dynamic` estiver mapeado como volume no host, copiar diretamente para o diretorio do host. O script verificara ambos os cenarios.

## Comandos pos-deploy

Apos as correcoes, o usuario precisara executar no servidor:

```bash
cd /caminho/do/projeto
# Redeployar frontend
docker stack deploy -c docker-compose.frontend.yml whats-frontend

# Copiar rota da API para o Traefik
docker cp traefik/supabase-api.yml $(docker ps -q -f name=traefik):/etc/traefik/dynamic/supabase-api.yml
```

