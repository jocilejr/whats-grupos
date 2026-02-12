

# Usar Validacao DNS para Certificado SSL

## Problema

O Certbot precisa da porta 80 para validacao HTTP, mas essa porta esta ocupada por outro servico. O Nginx roda na porta 81, entao os desafios ACME retornam 404.

## Solucao

Trocar a estrategia de validacao para **DNS manual**. O Certbot vai pedir que voce adicione um registro TXT no painel DNS do dominio. Nao precisa da porta 80.

O script vai:
1. Tentar `certbot --nginx` primeiro (funciona se porta 80 estiver livre)
2. Se falhar, tentar `certbot certonly --manual --preferred-challenges dns` como fallback
3. O Certbot vai pausar e mostrar um registro TXT para voce adicionar no DNS
4. Apos adicionar, voce pressiona Enter e o certificado e gerado
5. O script configura o Nginx com os certificados manualmente

**Nota importante**: Na renovacao (a cada 90 dias), voce precisara repetir o processo DNS manualmente, ou configurar um plugin DNS automatico para seu provedor.

## Detalhe tecnico

### Arquivo `install.sh` - Bloco 9/9

Substituir o fallback standalone por validacao DNS manual:

```text
log_step "9/9 - Configurando SSL com Certbot"

# Tentar com plugin nginx (modo preferido - configura tudo)
certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" \
  --non-interactive --agree-tos -m "$SSL_EMAIL" 2>&1

if [ $? -ne 0 ]; then
  log_warn "Certbot --nginx falhou. Usando validacao DNS manual..."
  echo ""
  echo -e "${YELLOW}O Certbot vai pedir que voce adicione registros TXT no DNS.${NC}"
  echo -e "${YELLOW}Adicione os registros no painel do seu provedor de dominio e pressione Enter.${NC}"
  echo ""

  certbot certonly --manual --preferred-challenges dns \
    -d "$DOMAIN" -d "$API_DOMAIN" \
    --agree-tos -m "$SSL_EMAIL"

  if [ $? -eq 0 ]; then
    CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
    # ... (adicionar blocos SSL ao Nginx manualmente - mesmo codigo existente)
    nginx -t && systemctl restart nginx
    log_success "SSL configurado (validacao DNS + config manual)."
  else
    log_warn "SSL nao configurado."
    log_info "Configure manualmente depois: certbot certonly --manual --preferred-challenges dns -d ${DOMAIN} -d ${API_DOMAIN}"
  fi
else
  log_success "SSL configurado."
fi
```

Mudancas chave:
- Remover `--non-interactive` no fallback DNS (precisa de interacao para mostrar o registro TXT)
- Remover `systemctl stop nginx` (nao precisa parar nada)
- Usar `--manual --preferred-challenges dns` em vez de `--standalone`
- Manter a configuracao manual do Nginx com blocos SSL (mesmo codigo existente para listen 443)

| Acao | Arquivo |
|------|---------|
| Editar | `install.sh` - bloco 9/9 (trocar standalone por DNS manual) |

