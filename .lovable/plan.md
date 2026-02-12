

# SSL Automatico na Instalacao

## Problema

Durante a instalacao, o Certbot nao consegue usar a porta 80 porque o container `kong` do Supabase ja esta rodando nela. O fallback atual exige interacao manual (validacao DNS).

## Solucao

Parar temporariamente o container `kong` antes de emitir o certificado, e reinicia-lo logo em seguida. Como e uma instalacao inicial (nao ha usuarios conectados ainda), nao ha impacto.

## Fluxo

1. Parar o container `kong` (libera porta 80)
2. Executar `certbot certonly --standalone` (automatico, sem interacao)
3. Reiniciar `kong`
4. Configurar blocos HTTPS no Nginx
5. Se tudo falhar, mostrar comando manual como fallback

## Detalhe tecnico

### Arquivo: `install.sh` - Bloco 9/9

Substituir o bloco SSL atual por:

```text
log_step "9/9 - Configurando SSL com Certbot"

# Parar kong temporariamente para liberar porta 80
cd "${SUPABASE_DIR}/docker"
log_info "Parando gateway temporariamente para validacao SSL..."
docker compose stop kong 2>/dev/null || true
sleep 2

# Emitir certificado (standalone, 100% automatico)
certbot certonly --standalone \
  -d "$DOMAIN" -d "$API_DOMAIN" \
  --non-interactive --agree-tos -m "$SSL_EMAIL" 2>&1
CERT_RESULT=$?

# Reiniciar kong imediatamente
log_info "Reiniciando gateway..."
docker compose start kong 2>/dev/null || true

if [ $CERT_RESULT -eq 0 ]; then
  CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"

  # Adicionar blocos HTTPS ao Nginx (frontend e API)
  # ... (mesmo codigo existente dos blocos listen 443)

  nginx -t && systemctl restart nginx
  log_success "SSL configurado automaticamente."
else
  log_warn "SSL automatico falhou."
  log_info "Configure manualmente depois:"
  log_info "  1. docker compose -f ${SUPABASE_DIR}/docker/docker-compose.yml stop kong"
  log_info "  2. certbot certonly --standalone -d ${DOMAIN} -d ${API_DOMAIN} --agree-tos -m ${SSL_EMAIL}"
  log_info "  3. docker compose -f ${SUPABASE_DIR}/docker/docker-compose.yml start kong"
fi
```

Tambem adicionar renovacao automatica via cron que para/inicia o kong:

```text
# Configurar renovacao automatica do SSL
cat > /etc/letsencrypt/renewal-hooks/pre/stop-kong.sh <<HOOKEOF
#!/bin/bash
cd ${SUPABASE_DIR}/docker && docker compose stop kong
HOOKEOF

cat > /etc/letsencrypt/renewal-hooks/post/start-kong.sh <<HOOKEOF
#!/bin/bash
cd ${SUPABASE_DIR}/docker && docker compose start kong
HOOKEOF

chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-kong.sh
chmod +x /etc/letsencrypt/renewal-hooks/post/start-kong.sh
```

| Acao | Arquivo | Descricao |
|------|---------|-----------|
| Editar | `install.sh` bloco 9/9 | Trocar validacao DNS por standalone automatico com stop/start do kong |
| Adicionar | `install.sh` bloco 9/9 | Hooks de renovacao automatica do certificado |

