

## Adicionar CORS no Nginx para rotas /r/ (Smart Links)

### Problema

O site externo (`grupo.comunidademeire.online`) faz fetch para `https://app.simplificandogrupos.com/r/comunidade-rosana-get` via JavaScript. O nginx que serve o frontend nao envia headers CORS, entao o navegador bloqueia a requisicao.

A edge function `smart-link-api` ja tem CORS configurado e funciona, mas exigiria que o usuario atualizasse todas as URLs externas. Uma solucao complementar e adicionar CORS diretamente no nginx para as rotas `/r/`.

### Solucao (duas frentes)

#### 1. Nginx - Adicionar headers CORS para rotas `/r/`

Atualizar os arquivos de configuracao do nginx para adicionar um bloco `location` especifico para `/r/` com headers CORS:

**Arquivos:** `nginx/spa.conf` e `nginx/frontend.conf.template`

Adicionar antes do `location /` existente:

```text
location /r/ {
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type" always;

    if ($request_method = OPTIONS) {
        return 204;
    }

    try_files $uri $uri/ /index.html;
}
```

Isso garante que qualquer requisicao fetch para `/r/slug-get` receba os headers CORS necessarios.

#### 2. Manter a URL da edge function como alternativa

A "URL de Retorno (Texto)" no CampaignLeadsDialog continuara apontando para a edge function (ja implementado), que e a opcao mais robusta para integracao com sistemas externos.

### Resultado

- URLs existentes como `https://app.simplificandogrupos.com/r/slug-get` passarao a funcionar com CORS (apos deploy do nginx atualizado)
- A URL da edge function continua disponivel como alternativa mais confiavel
- O usuario nao precisa atualizar URLs ja configuradas em sites externos

### Nota importante

Apos implementar, o usuario precisara fazer o deploy da nova configuracao do nginx no servidor de producao para que as mudancas tenham efeito.

