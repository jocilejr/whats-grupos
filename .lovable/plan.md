

# Corrigir variáveis de ambiente do Baileys Server

## Problema
O container `baileys-server` é criado pelo `scripts/deploy.sh` sem as variáveis de ambiente `SUPABASE_FUNCTIONS_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Sem elas, o webhook de eventos de grupo envia `Authorization: Bearer ` (vazio), resultando em 401 Unauthorized.

## Solucao

Alterar o `scripts/deploy.sh` para passar as variáveis de ambiente ao criar o container do Baileys.

### Alteracao tecnica

**Arquivo**: `scripts/deploy.sh`

No bloco que faz `docker run` do baileys-server (linha ~47), adicionar as variáveis de ambiente lidas do arquivo `.credentials`:

```bash
docker run -d --name baileys-server --restart unless-stopped \
  --network supabase_default \
  -e SUPABASE_FUNCTIONS_URL=http://supabase-kong:8000 \
  -e SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
  -p 127.0.0.1:3100:3100 -v baileys-data:/data baileys-server
```

A variável `SERVICE_ROLE_KEY` já deve existir no arquivo `/opt/whats-grupos/.credentials` (gerado pelo `install.sh`). O script já faz `source` desse arquivo antes desse bloco.

Se a variável no `.credentials` tiver outro nome, será necessário ajustar. Para garantir, o bloco carregará o `.credentials` e usará a chave correta.

## Apos deploy

Executar na VPS:
```bash
cd /opt/whats-grupos && git pull && sudo ./scripts/deploy.sh
```

Em seguida, verificar que as variáveis estão presentes:
```bash
docker inspect baileys-server --format '{{json .Config.Env}}' | python3 -m json.tool
```

E testar o webhook:
```bash
docker exec baileys-server wget -q -O- --post-data='{}' --header='Content-Type: application/json' --header='Authorization: Bearer <SERVICE_ROLE_KEY>' http://supabase-kong:8000/functions/v1/group-events-webhook
```

