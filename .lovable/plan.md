

# Nginx em Porta Alternativa se 80 Estiver Ocupada

## Problema

A porta 80 ja esta em uso por outro servico. O Nginx falha ao iniciar, e nao queremos parar processos existentes.

## Solucao

Usar a mesma logica que ja existe para o PostgreSQL: detectar se a porta 80 esta ocupada e, se sim, usar uma porta alternativa (81, 8080, 8081, etc.). Atualizar os templates do Nginx e o Certbot para usar essa porta.

## Detalhe tecnico

### 1. `install.sh` - Detectar porta livre (antes do bloco 8/9)

Adicionar deteccao de porta antes de configurar o Nginx:

```text
# Verificar se porta 80 esta disponivel
HTTP_PORT=80
if ss -tlnp | grep -q ':80 '; then
  log_warn "Porta 80 em uso. Procurando porta alternativa..."
  for PORT in 81 8080 8081 8082; do
    if ! ss -tlnp | grep -q ":${PORT} "; then
      HTTP_PORT=$PORT
      break
    fi
  done
  if [ "$HTTP_PORT" -eq 80 ]; then
    log_error "Nenhuma porta HTTP alternativa disponivel."
    exit 1
  fi
  log_info "Nginx usara porta alternativa: ${HTTP_PORT}"
fi
```

### 2. Templates do Nginx - Usar placeholder `{{HTTP_PORT}}`

**`nginx/frontend.conf.template`**: Trocar `listen 80` por `listen {{HTTP_PORT}}`

**`nginx/api.conf.template`**: Trocar `listen 80` por `listen {{HTTP_PORT}}`

### 3. `install.sh` - Substituir a porta nos templates (bloco 8/9)

Atualizar os comandos `sed` para incluir a substituicao de `{{HTTP_PORT}}`:

```text
sed "s|{{DOMAIN}}|${DOMAIN}|g; s|{{PROJECT_DIR}}|${PROJECT_DIR}|g; s|{{HTTP_PORT}}|${HTTP_PORT}|g" \
  "${PROJECT_DIR}/nginx/frontend.conf.template" \
  > /etc/nginx/sites-available/whats-grupos

sed "s|{{API_DOMAIN}}|${API_DOMAIN}|g; s|{{HTTP_PORT}}|${HTTP_PORT}|g" \
  "${PROJECT_DIR}/nginx/api.conf.template" \
  > /etc/nginx/sites-available/whats-grupos-api
```

### 4. `install.sh` - Ajustar Certbot para porta alternativa

Se estiver em porta diferente de 80, usar o plugin standalone com `--http-01-port`:

```text
if [ "$HTTP_PORT" -eq 80 ]; then
  certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL"
else
  log_warn "Nginx em porta ${HTTP_PORT}. Certbot usara --http-01-port ${HTTP_PORT}."
  certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" \
    --http-01-port "$HTTP_PORT"
fi
```

### 5. `install.sh` - Mostrar porta no resumo final

Se a porta for diferente de 80, exibir aviso:

```text
if [ "$HTTP_PORT" -ne 80 ]; then
  echo -e "  ${YELLOW}NOTA: Nginx rodando na porta ${HTTP_PORT} (porta 80 estava em uso)${NC}"
fi
```

## Resumo dos arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `install.sh` - adicionar deteccao de porta e ajustar blocos 8/9 e 9/9 |
| Editar | `nginx/frontend.conf.template` - `listen {{HTTP_PORT}}` |
| Editar | `nginx/api.conf.template` - `listen {{HTTP_PORT}}` |

