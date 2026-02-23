

# Corrigir Permissoes GRANT nas Tabelas de Grupos

## Problema Raiz

As tabelas `group_participant_events` e `group_stats` foram criadas **sem GRANT de permissoes** para os roles `anon`, `authenticated` e `service_role`. Sem essas permissoes, o PostgREST nao consegue acessar as tabelas e retorna **404 (Not Found)**.

As politicas RLS estao corretas (PERMISSIVE), mas sao irrelevantes se o role nao tem permissao basica de acesso a tabela.

## Solucao

Criar uma migracao SQL que adiciona as permissoes GRANT necessarias:

```sql
-- group_participant_events: leitura para authenticated, escrita para service_role
GRANT SELECT ON public.group_participant_events TO anon, authenticated;
GRANT INSERT ON public.group_participant_events TO service_role;
GRANT ALL ON public.group_participant_events TO service_role;

-- group_stats: leitura e escrita para authenticated (usuarios gerenciam seus proprios dados)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_stats TO authenticated;
GRANT ALL ON public.group_stats TO service_role;
```

## Arquivo a modificar

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Adicionar GRANT para ambas as tabelas |

## Acao manual na VPS

Apos aplicar a migracao no Lovable Cloud, executar na VPS:

```bash
docker compose -f /opt/supabase-docker/docker/docker-compose.yml exec -T db psql -U postgres -d postgres <<'EOF'
GRANT SELECT ON public.group_participant_events TO anon, authenticated;
GRANT ALL ON public.group_participant_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_stats TO authenticated;
GRANT ALL ON public.group_stats TO service_role;
EOF
```

Depois reiniciar o PostgREST para detectar as novas permissoes:

```bash
docker compose -f /opt/supabase-docker/docker/docker-compose.yml restart rest
```

