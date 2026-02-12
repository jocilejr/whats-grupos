

# Nginx na porta 80 como unico ponto de entrada

## Problema atual

O Kong (gateway do Supabase Docker) publica na porta 80, forcando o Nginx para a porta 81. Isso impede acesso direto via HTTPS e complica o SSL.

## Solucao

Remover a publicacao da porta 80 do Kong no Docker e colocar o Nginx como unico ouvinte nas portas 80 e 443. O Kong continua acessivel internamente em `localhost:8000` (o proxy do Nginx ja aponta para la).

## Fluxo

1. Apos subir os containers do Supabase, alterar o `docker-compose.yml` para remover o mapeamento da porta `80:8000` do Kong
2. Reiniciar o container Kong (agora sem porta 80 exposta)
3. Nginx assume a porta 80 normalmente (sem precisar de porta alternativa)
4. SSL via Certbot funciona sem parar nenhum container (porta 80 e do Nginx)
5. Renovacao automatica funciona sem hooks de stop/start do Kong

## Beneficios

- Nginx sempre na porta 80/443 (sem gambiarras de porta alternativa)
- SSL emitido e renovado sem parar nenhum servico
- Zero downtime durante renovacao de certificados
- Arquitetura mais limpa: um unico ponto de entrada

## Detalhes tecnicos

### Arquivo: `install.sh`

**Bloco 2/9 - Apos `docker compose up -d`:**
Adicionar comando para remover a porta 80 do Kong:

```text
# Remover porta 80 do Kong (Nginx sera o unico gateway externo)
log_info "Configurando Kong para acesso apenas interno..."
cd "${SUPABASE_DIR}/docker"
sed -i 's/- "${KONG_HTTP_PORT}:8000"/# - "${KONG_HTTP_PORT}:8000"/' docker-compose.yml
# Tambem cobrir formato alternativo
sed -i 's/- "8000:8000"/# - "8000:8000"/' docker-compose.yml
docker compose up -d kong --force-recreate
```

**Bloco 8/9 - Remover logica de porta alternativa:**
Eliminar toda a verificacao `if ss -tlnp | grep -q ':80 '` e fixar `HTTP_PORT=80`, pois agora a porta estara sempre disponivel.

**Bloco 9/9 - Simplificar SSL:**
Remover stop/start do Kong. Usar `certbot --nginx` diretamente (Nginx ja esta na porta 80):

```text
log_step "9/9 - Configurando SSL com Certbot"

# Criar arquivos SSL auxiliares se nao existirem
if [ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
  cat > /etc/letsencrypt/options-ssl-nginx.conf <<'SSLCONF'
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:...";
SSLCONF
fi

if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
  curl -sS https://raw.githubusercontent.com/certbot/certbot/main/certbot/certbot/ssl-dhparams.pem \
    -o /etc/letsencrypt/ssl-dhparams.pem
fi

certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" \
  --non-interactive --agree-tos -m "$SSL_EMAIL" 2>&1
CERT_RESULT=$?

if [ $CERT_RESULT -eq 0 ]; then
  log_success "SSL configurado automaticamente."
else
  log_warn "SSL automatico falhou. Configure manualmente: certbot --nginx -d ${DOMAIN} -d ${API_DOMAIN}"
fi
```

**Remover hooks de renovacao** (nao sao mais necessarios, pois o Kong nao ocupa a porta 80).

| Acao | Arquivo | Descricao |
|------|---------|-----------|
| Editar | `install.sh` bloco 2/9 | Comentar porta 80 do Kong no docker-compose e recriar container |
| Editar | `install.sh` bloco 8/9 | Remover logica de porta alternativa, fixar porta 80 |
| Editar | `install.sh` bloco 9/9 | Usar `certbot --nginx`, remover stop/start do Kong e hooks de renovacao |
| Editar | `install.sh` bloco 9/9 | Adicionar criacao de arquivos SSL auxiliares |

