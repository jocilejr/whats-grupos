

# Corrigir remoção do analytics no install.sh

## Problema
Os comandos `sed` atuais falham em remover referências ao `analytics` no formato expandido de `depends_on` usado pelo Supabase:

```yaml
depends_on:
  analytics:
    condition: service_healthy
```

O `sed` atual remove apenas linhas com `- analytics` (formato lista), mas não o formato mapa com sub-chaves indentadas.

## Solução

Substituir os comandos `sed` por uma abordagem mais robusta que:

1. Comenta o bloco inteiro do serviço `analytics`
2. Remove referências ao `analytics` em `depends_on` tanto no formato lista (`- analytics`) quanto no formato mapa (`analytics:` + `condition:`)
3. Remove blocos `depends_on:` que ficaram vazios após a remoção

### Arquivo: `install.sh` (linhas 340-345)

Substituir os comandos `sed` existentes por:

```bash
log_info "Desabilitando servico analytics (opcional, evita falhas)..."

# 1. Comentar o bloco do servico analytics
sed -i '/^  analytics:/,/^  [a-z]/{/^  [a-z]/!s/^/#/}' docker-compose.yml 2>/dev/null || true
sed -i 's/^  analytics:/#  analytics:/' docker-compose.yml 2>/dev/null || true

# 2. Remover depends_on analytics no formato lista (- analytics)
sed -i '/- analytics/d' docker-compose.yml 2>/dev/null || true

# 3. Remover depends_on analytics no formato mapa (analytics: + condition:)
sed -i '/^      analytics:/{N;d}' docker-compose.yml 2>/dev/null || true
sed -i '/^        analytics:/{N;d}' docker-compose.yml 2>/dev/null || true

# 4. Remover blocos depends_on que ficaram vazios
sed -i -E '/^\s+depends_on:\s*$/{N;/^\s+depends_on:\s*\n\s*[a-z]/!d}' docker-compose.yml 2>/dev/null || true

log_success "Servico analytics desabilitado."
```

A mudança principal é o passo 3: remove a linha `analytics:` junto com a linha seguinte (`condition: service_healthy`), cobrindo diferentes níveis de indentação (6 e 8 espaços). O passo 4 limpa blocos `depends_on:` que ficaram sem nenhum serviço listado.

