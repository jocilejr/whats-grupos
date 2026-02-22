

# Correção das Políticas RLS (RESTRICTIVE -> PERMISSIVE)

## Problema Identificado

Todas as políticas RLS do projeto estão criadas como **RESTRICTIVE** (`Permissive: No`). No PostgreSQL, quando existem apenas políticas restritivas e nenhuma permissiva, **todo acesso é negado**. Por isso o `useRole()` não consegue ler a tabela `user_roles` e o sistema trata o admin como usuário comum.

## Solução

Recriar as políticas RLS como **PERMISSIVE** (padrão do PostgreSQL) nas seguintes tabelas:

1. **user_roles** - "Users can read own role" e "Admins can manage all roles"
2. **user_plans** - "Users can read own plan" e "Admins can manage all plans"
3. **profiles** - todas as 3 políticas (insert, update, select)
4. **api_configs** - "Users manage own api_configs"
5. **campaigns** - "Users manage own campaigns"
6. **message_logs** - "Users manage own logs"
7. **message_queue** - "Users manage own queue items"
8. **message_templates** - "Users manage own templates"
9. **scheduled_messages** - "Users manage own schedules"
10. **global_config** - "Admins can manage global config"

## Detalhes Técnicos

Uma migração SQL será executada para:

1. Dropar todas as políticas restritivas existentes
2. Recriá-las como permissivas (que é o comportamento padrão do `CREATE POLICY`)

Exemplo para `user_roles`:
```text
DROP POLICY "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

Isso será repetido para todas as 10 tabelas listadas.

**Importante para o VPS:** Após aplicar a migração no Lovable Cloud, o mesmo SQL precisa ser executado no banco do VPS para corrigir o problema lá também. Fornecerei o comando completo para execução via `docker exec`.

## Impacto

- Zero mudanças no código frontend
- Apenas migração SQL de políticas RLS
- Após aplicação, o hook `useRole()` conseguirá ler o role "admin" corretamente e o menu de administração aparecerá

