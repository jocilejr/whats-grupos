

# Corrigir Politicas RLS da Tabela group_participant_events

## Problema

As politicas RLS da tabela `group_participant_events` foram criadas como **RESTRICTIVE** em vez de **PERMISSIVE**. Sem uma politica permissiva correspondente, o acesso fica completamente bloqueado -- tanto leitura quanto escrita.

Isso causa:
- **404 (Not Found)** nas consultas GET a `rest/v1/group_participant_events` (o frontend nao consegue ler eventos)
- **500 (Internal Server Error)** no `sync-group-stats` (a edge function nao consegue consultar eventos)

## Solucao

Recriar as duas politicas como PERMISSIVE via migracao SQL:

```sql
-- Remover politicas RESTRICTIVE existentes
DROP POLICY IF EXISTS "Users read own instance events" ON public.group_participant_events;
DROP POLICY IF EXISTS "Service role can insert events" ON public.group_participant_events;

-- Recriar como PERMISSIVE
CREATE POLICY "Users read own instance events" ON public.group_participant_events
  FOR SELECT USING (
    instance_name IN (
      SELECT ac.instance_name FROM api_configs ac WHERE ac.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert events" ON public.group_participant_events
  FOR INSERT WITH CHECK (true);
```

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Recriar politicas RLS como PERMISSIVE |

## Acao manual na VPS

Apos a migracao ser aplicada aqui no Lovable Cloud, sera necessario executar o mesmo SQL na VPS para corrigir o ambiente de producao. Fornecerei o comando Docker pronto para copiar e colar.

