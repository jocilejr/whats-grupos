
# Corrigir install.sh para Ignorar supabase-analytics

## Problema
O container `supabase-analytics` falha ao iniciar (depende de configuracoes especificas do Logflare), travando toda a instalacao na linha `docker compose up -d` que retorna erro fatal.

## Solucao
Antes de subir os containers, o script vai automaticamente:
1. Comentar o servico `analytics` inteiro no `docker-compose.yml` do Supabase
2. Remover qualquer `depends_on` referenciando `analytics` nos outros servicos
3. Subir os containers normalmente sem o analytics

Isso garante que a instalacao nunca mais trave por causa desse servico opcional.

## Detalhes Tecnicos

### Arquivo modificado: `install.sh`

Antes da linha `docker compose up -d` (linha 343), adicionar comandos `sed` que:

```text
# 1. Comentar o bloco do servico analytics no docker-compose.yml
sed -i '/^  analytics:/,/^  [a-z]/{/^  [a-z]/!s/^/#/}' docker-compose.yml
sed -i 's/^  analytics:/#  analytics:/' docker-compose.yml

# 2. Remover depends_on analytics de outros servicos
sed -i '/- analytics/d' docker-compose.yml
sed -i '/condition: service_healthy/{ N; /analytics/d }' docker-compose.yml
```

Tambem adicionar um log informativo:
```text
log_info "Desabilitando servico analytics (opcional, evita falhas)..."
```

### Comandos para reinstalar do zero na VPS

Antes de rodar o instalador atualizado:
```bash
cd /opt/supabase-docker/docker && docker compose down -v 2>/dev/null || true
docker rm -f baileys-server 2>/dev/null || true
docker volume rm baileys-data 2>/dev/null || true
rm -rf /opt/supabase-docker

cd /opt/whats-grupos
git pull origin main
sudo ./install.sh
```
