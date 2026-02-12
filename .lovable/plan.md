

# Correcao do Instalador - Tratamento de Dominio

## Problema Identificado

O script `install.sh` nao trata o caso em que o usuario digita o dominio com protocolo (`http://` ou `https://`). Isso resulta em URLs quebradas como:

```text
Dominio frontend: http://app.simplificandogrupos.com/
Dominio API:      api.http://app.simplificandogrupos.com/
```

O correto seria:

```text
Dominio frontend: app.simplificandogrupos.com
Dominio API:      api.app.simplificandogrupos.com
```

## Correcao

Adicionar uma limpeza automatica do input do dominio logo apos a leitura, removendo:
- Prefixo `http://` ou `https://`
- Barra final `/`
- Espacos extras

### Detalhe tecnico

No `install.sh`, logo apos o `read -p` do dominio (linha 58-62), adicionar:

```text
# Limpar protocolo e barra do dominio
DOMAIN=$(echo "$DOMAIN" | sed -e 's|^https\?://||' -e 's|/$||' -e 's|^www\.||' | xargs)
```

Isso garante que mesmo se o usuario digitar `http://app.simplificandogrupos.com/`, o valor sera corrigido para `app.simplificandogrupos.com`.

Tambem sera adicionada uma validacao basica para garantir que o dominio tem formato valido (contem pelo menos um ponto).

