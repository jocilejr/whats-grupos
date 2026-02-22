

# Correção das Políticas RLS: RESTRICTIVE para PERMISSIVE

## Problema

Todas as políticas RLS do banco estão criadas como **RESTRICTIVE**. No PostgreSQL, quando existem apenas políticas restritivas sem nenhuma permissiva, **todo acesso é negado**. Por isso o `useRole()` não consegue ler `user_roles` e o menu de admin não aparece.

## Solução

Recriar todas as políticas RLS como **PERMISSIVE** (comportamento padrão do PostgreSQL). Isso será feito via uma migração SQL no Lovable Cloud.

Após aplicar aqui, fornecerei o SQL completo para executar na VPS também.

## Tabelas afetadas

1. **user_roles** - 2 policies (read own role + admins manage)
2. **user_plans** - 2 policies (read own plan + admins manage)
3. **profiles** - 3 policies (insert, update, select own)
4. **global_config** - 1 policy (admins manage)
5. **api_configs** - 1 policy (users manage own)
6. **campaigns** - 1 policy (users manage own)
7. **message_logs** - 1 policy (users manage own)
8. **message_queue** - 1 policy (users manage own)
9. **message_templates** - 1 policy (users manage own)
10. **scheduled_messages** - 1 policy (users manage own)

## Detalhes Tecnicos

Uma unica migracao SQL que:
1. Remove (DROP) cada politica restritiva existente
2. Recria a mesma politica sem a clausula `AS RESTRICTIVE`, tornando-a permissiva (padrao)

Exemplo:
```text
DROP POLICY "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

Apos aplicar no Lovable Cloud, fornecerei o comando completo para rodar na VPS via `docker exec`.

## Impacto

- Nenhuma mudanca no codigo frontend
- Apenas migracao SQL
- Apos aplicacao, o hook `useRole()` conseguira ler o role "admin" e o menu aparecera

