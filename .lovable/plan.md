

# Configurar Traefik para rotear o frontend e API do Supabase

## Contexto

O servidor possui **Traefik v3.4.0** rodando no Docker Swarm, controlando as portas 80 e 443. Por isso, o Nginx nao consegue receber trafego externo. A solucao e usar o Traefik como ponto de entrada, roteando:

- `app.simplificandogrupos.com` para os arquivos do frontend (React)
- `api.app.simplificandogrupos.com` para o Kong do Supabase (porta 8000)

## Estrategia

1. **Frontend**: Criar um container Nginx leve (sem bind de porta) que serve os arquivos estaticos do `dist/`. O Traefik roteia para esse container via labels.
2. **API**: Usar o Traefik File Provider para criar uma rota dinamica que aponta para `localhost:8000` (Kong), sem precisar modificar o docker-compose do Supabase.
3. **SSL**: O Traefik ja gerencia certificados via Let's Encrypt (certresolver). Basta configurar as labels corretamente.
4. **Nginx do host**: Sera desabilitado, pois nao e mais necessario.

## Arquivos a criar/modificar

### 1. Criar `docker-compose.frontend.yml` (novo)

Arquivo Docker Compose para o container do frontend, com labels do Traefik:

```yaml
version: "3.8"
services:
  frontend:
    image: nginx:alpine
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx/spa.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - traefik_public
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.whats-frontend.rule=Host(`app.simplificandogrupos.com`)"
        - "traefik.http.routers.whats-frontend.entrypoints=websecure"
        - "traefik.http.routers.whats-frontend.tls.certresolver=letsencrypt"
        - "traefik.http.services.whats-frontend.loadbalancer.server.port=80"

networks:
  traefik_public:
    external: true
```

### 2. Criar `nginx/spa.conf` (novo)

Configuracao interna do Nginx para SPA (sem listen de porta externa):

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml text/javascript image/svg+xml;
}
```

### 3. Criar rota Traefik para a API (File Provider)

Criar arquivo de configuracao dinamica do Traefik para rotear `api.app.simplificandogrupos.com` para o Kong:

```yaml
# /opt/traefik/dynamic/supabase-api.yml
http:
  routers:
    supabase-api:
      rule: "Host(`api.app.simplificandogrupos.com`)"
      entryPoints:
        - websecure
      service: supabase-kong
      tls:
        certResolver: letsencrypt

  services:
    supabase-kong:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:8000"
```

Nota: O caminho exato do diretorio de configuracao dinamica do Traefik depende de como ele foi configurado. Sera necessario verificar o `traefik.yml` para confirmar o path do File Provider.

### 4. Modificar `install.sh`

Atualizar o script de instalacao para:

- **Remover** toda a secao de instalacao/configuracao do Nginx (blocos 8/9)
- **Remover** a secao de SSL do Certbot (Traefik gerencia SSL)
- **Adicionar** deteccao do Traefik no Docker Swarm
- **Adicionar** deploy do frontend como stack no Swarm
- **Adicionar** configuracao dinamica do Traefik para a API
- **Atualizar** o `deploy.sh` para rebuildar e redeployar o frontend stack

### 5. Modificar `scripts/deploy.sh`

Atualizar para redeployar o stack do frontend apos o build:

```bash
docker stack deploy -c docker-compose.frontend.yml whats-frontend
```

## Passos manuais necessarios agora (antes de alterar o codigo)

Para verificar a configuracao do Traefik e garantir que o plano funcione, execute:

```bash
# 1. Ver config do Traefik (caminho do file provider)
docker exec $(docker ps -q -f name=traefik) cat /etc/traefik/traefik.yml 2>/dev/null || \
docker exec $(docker ps -q -f name=traefik) cat /traefik.yml 2>/dev/null

# 2. Ver nome da rede do Traefik
docker network ls | grep -i traefik

# 3. Ver o certresolver configurado
docker service inspect traefik_traefik --pretty 2>/dev/null | grep -i cert
```

Cole a saida desses comandos para que eu possa ajustar o plano com os nomes corretos da rede, certresolver e caminho do file provider.

## Resumo

| Acao | Arquivo | Descricao |
|------|---------|-----------|
| Criar | `docker-compose.frontend.yml` | Stack do frontend com labels Traefik |
| Criar | `nginx/spa.conf` | Config interna do Nginx para SPA |
| Criar | Traefik dynamic config | Rota para API via File Provider |
| Modificar | `install.sh` | Remover Nginx/Certbot, adicionar deploy via Traefik |
| Modificar | `scripts/deploy.sh` | Redeployar stack do frontend |
| Desabilitar | Nginx do host | `systemctl disable nginx` |

