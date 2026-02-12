

# Corrigir Certbot - Plugin Nginx Nao Instalado

## Problema

O Certbot esta instalado no servidor, mas sem o plugin `python3-certbot-nginx`. O script atual so instala o pacote se o comando `certbot` nao existir -- se ja existir (sem o plugin), pula a instalacao.

Alem disso, quando o Nginx esta em porta alternativa (81), o modo `--nginx` do Certbot pode ter problemas para detectar o Nginx.

## Solucao

Duas mudancas:

### 1. Sempre garantir que o plugin nginx esteja instalado

No bloco 1/9, trocar a verificacao condicional por uma instalacao incondicional do plugin:

```text
# Certbot
apt-get install -y -qq certbot python3-certbot-nginx
log_success "Certbot instalado."
```

Isso e seguro porque `apt-get install` nao reinstala pacotes ja presentes.

### 2. Usar modo standalone quando em porta alternativa

No bloco 9/9, quando a porta nao e 80, usar `--standalone` em vez de `--nginx`. O modo standalone levanta seu proprio servidor HTTP temporario na porta especificada, sem depender do Nginx:

```text
if [ "$HTTP_PORT" -eq 80 ]; then
  certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" \
    --non-interactive --agree-tos -m "$SSL_EMAIL"
else
  log_warn "Nginx em porta ${HTTP_PORT}. Certbot usara modo standalone."
  # Parar nginx temporariamente para liberar a porta para o certbot
  systemctl stop nginx || true
  certbot certonly --standalone -d "$DOMAIN" -d "$API_DOMAIN" \
    --non-interactive --agree-tos -m "$SSL_EMAIL" \
    --http-01-port "$HTTP_PORT"
  # Reconfigurar nginx com os certificados gerados e reiniciar
  # Adicionar SSL aos configs do Nginx
  # ... (detalhes abaixo)
  systemctl start nginx
fi
```

**Porem**, o modo standalone gera certificados mas nao configura o Nginx automaticamente. A abordagem mais simples e resiliente:

- Sempre usar `--nginx` (que configura tudo automaticamente)
- Garantir que o plugin esteja instalado
- Se falhar, tentar `certonly --standalone` como fallback e configurar SSL manualmente

### Abordagem final (resiliente com fallback)

```text
# Garantir plugin instalado
apt-get install -y -qq python3-certbot-nginx

# Tentar com plugin nginx primeiro
certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" \
  --non-interactive --agree-tos -m "$SSL_EMAIL" 2>/dev/null

if [ $? -ne 0 ]; then
  log_warn "Certbot --nginx falhou. Tentando modo standalone..."
  systemctl stop nginx 2>/dev/null || true
  certbot certonly --standalone -d "$DOMAIN" -d "$API_DOMAIN" \
    --non-interactive --agree-tos -m "$SSL_EMAIL"
  
  if [ $? -eq 0 ]; then
    # Adicionar config SSL nos arquivos do Nginx
    # (inserir listen 443 ssl + caminhos dos certificados)
    ...configurar SSL manualmente nos sites-available...
    systemctl start nginx
  else
    log_warn "SSL nao configurado. Configure manualmente depois."
    systemctl start nginx
  fi
fi
```

## Detalhe tecnico

### Arquivo `install.sh` - Bloco 1/9 (Certbot)

Substituir o bloco condicional do Certbot por instalacao direta:

```text
# Certbot + plugin nginx (sempre instalar para garantir)
log_info "Instalando/verificando Certbot..."
apt-get install -y -qq certbot python3-certbot-nginx
log_success "Certbot pronto."
```

### Arquivo `install.sh` - Bloco 9/9 (SSL)

Substituir todo o bloco SSL por versao resiliente com fallback:

```text
log_step "9/9 - Configurando SSL com Certbot"

# Tentar com plugin nginx (modo preferido - configura tudo)
certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" \
  --non-interactive --agree-tos -m "$SSL_EMAIL" 2>&1

if [ $? -ne 0 ]; then
  log_warn "Certbot --nginx falhou. Tentando modo standalone..."
  systemctl stop nginx 2>/dev/null || true

  certbot certonly --standalone -d "$DOMAIN" -d "$API_DOMAIN" \
    --non-interactive --agree-tos -m "$SSL_EMAIL"

  if [ $? -eq 0 ]; then
    # Adicionar SSL aos configs do Nginx
    CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"

    # Adicionar bloco HTTPS ao frontend
    cat >> /etc/nginx/sites-available/whats-grupos <<SSLEOF

server {
    listen 443 ssl;
    server_name ${DOMAIN};
    ssl_certificate ${CERT_PATH}/fullchain.pem;
    ssl_certificate_key ${CERT_PATH}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root ${PROJECT_DIR}/dist;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
}
SSLEOF

    # Adicionar bloco HTTPS a API
    cat >> /etc/nginx/sites-available/whats-grupos-api <<SSLEOF

server {
    listen 443 ssl;
    server_name ${API_DOMAIN};
    ssl_certificate ${CERT_PATH}/fullchain.pem;
    ssl_certificate_key ${CERT_PATH}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50M;
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
SSLEOF

    systemctl start nginx
    log_success "SSL configurado (modo standalone + config manual)."
  else
    systemctl start nginx
    log_warn "SSL nao configurado automaticamente."
    log_info "Configure manualmente: certbot --nginx -d ${DOMAIN} -d ${API_DOMAIN}"
  fi
else
  log_success "SSL configurado."
fi
```

## Resumo dos arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `install.sh` - bloco 1/9 (garantir plugin nginx) |
| Editar | `install.sh` - bloco 9/9 (fallback standalone + config SSL manual) |

