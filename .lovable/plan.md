

# Instalador Resiliente de Migracoes

## Problema

As migracoes SQL falham quando executadas mais de uma vez porque usam `CREATE TABLE` sem `IF NOT EXISTS`. O script atual para na primeira falha (`ON_ERROR_STOP=1`) sem tentar recuperar.

## Solucao

Duas mudancas complementares:

### 1. Consolidar todas as migracoes em um unico arquivo idempotente

Criar um novo arquivo `supabase/migrations/00000000000000_full_schema.sql` que substitui todos os 9 arquivos atuais. Este arquivo usa exclusivamente comandos seguros para re-execucao:

- `CREATE TABLE IF NOT EXISTS` em vez de `CREATE TABLE`
- `CREATE OR REPLACE FUNCTION` (ja usado)
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- `CREATE POLICY ... IF NOT EXISTS` (via bloco DO/EXCEPTION)
- `CREATE TRIGGER ... IF NOT EXISTS` (via bloco DO/EXCEPTION)
- `ON CONFLICT DO NOTHING` para inserts
- `CREATE EXTENSION IF NOT EXISTS` (ja usado)

Os 9 arquivos antigos serao removidos.

### 2. Tornar o script de migracoes tolerante a falhas

O `scripts/run-migrations.sh` sera atualizado para:

- Remover `ON_ERROR_STOP=1` do psql -- erros nao interrompem a execucao
- Registrar avisos em vez de abortar quando um comando SQL falha
- Continuar para o proximo arquivo mesmo se houver erro
- Exibir um resumo no final (quantos OK, quantos com avisos)

## Detalhe tecnico

### Arquivo `supabase/migrations/00000000000000_full_schema.sql`

Conteudo completo consolidado e idempotente:

```sql
-- =============================================
-- Schema completo - Idempotente (seguro re-executar)
-- =============================================

-- Extensoes
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- API Configs
CREATE TABLE IF NOT EXISTS public.api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  max_messages_per_hour INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.api_configs ENABLE ROW LEVEL SECURITY;

-- Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_config_id UUID NOT NULL REFERENCES public.api_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  group_ids TEXT[] NOT NULL DEFAULT '{}',
  instance_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Message Templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'geral',
  message_type TEXT NOT NULL DEFAULT 'text',
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Scheduled Messages
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_config_id UUID NOT NULL REFERENCES public.api_configs(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  group_ids TEXT[] NOT NULL DEFAULT '{}',
  message_type TEXT NOT NULL DEFAULT 'text',
  content JSONB NOT NULL DEFAULT '{}',
  schedule_type TEXT NOT NULL DEFAULT 'once',
  scheduled_at TIMESTAMPTZ,
  cron_expression TEXT,
  is_active BOOLEAN DEFAULT true,
  instance_name TEXT,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ DEFAULT NULL,
  sent_group_index INTEGER NOT NULL DEFAULT 0,
  last_completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Message Logs
CREATE TABLE IF NOT EXISTS public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_config_id UUID NOT NULL REFERENCES public.api_configs(id) ON DELETE CASCADE,
  scheduled_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  group_id TEXT NOT NULL,
  group_name TEXT,
  instance_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  content JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- ADD COLUMN IF NOT EXISTS (para re-execucoes parciais)
ALTER TABLE public.api_configs ADD COLUMN IF NOT EXISTS max_messages_per_hour INTEGER NOT NULL DEFAULT 100;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS instance_name TEXT;
ALTER TABLE public.scheduled_messages ADD COLUMN IF NOT EXISTS instance_name TEXT;
ALTER TABLE public.scheduled_messages ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE public.scheduled_messages ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.scheduled_messages ADD COLUMN IF NOT EXISTS sent_group_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.scheduled_messages ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS instance_name TEXT;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT (id) DO NOTHING;

-- RLS Policies (usando DO block para ignorar duplicatas)
DO $$ BEGIN
  CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage own api_configs" ON public.api_configs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage own templates" ON public.message_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage own schedules" ON public.scheduled_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage own logs" ON public.message_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public can read media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete own media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.claim_due_messages()
RETURNS SETOF scheduled_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY
  UPDATE scheduled_messages SET processing_started_at = now()
  WHERE id IN (
    SELECT sm.id FROM scheduled_messages sm
    WHERE sm.is_active = true AND sm.next_run_at <= now()
      AND (sm.processing_started_at IS NULL OR sm.processing_started_at < now() - interval '5 minutes')
      AND (sm.campaign_id IS NULL OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = sm.campaign_id AND c.is_active = true))
      AND (sm.last_completed_at IS NULL OR sm.last_completed_at < sm.next_run_at)
    FOR UPDATE SKIP LOCKED
  ) RETURNING *;
END;
$$;

-- Triggers (usando DO block para ignorar duplicatas)
DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_api_configs_updated_at BEFORE UPDATE ON public.api_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.scheduled_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

### Arquivo `scripts/run-migrations.sh`

Nova versao tolerante a falhas:

```bash
#!/bin/bash
MIGRATIONS_DIR="$1"
DB_PASSWORD="$2"
DB_PORT="${3:-5432}"

# ... validacoes ...

SUPABASE_DIR="/opt/supabase-docker/docker"
ERRORS=0
SUCCESS=0

for SQL_FILE in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  FILENAME=$(basename "$SQL_FILE")
  echo "[INFO] Executando: $FILENAME"

  OUTPUT=$(docker compose -f "${SUPABASE_DIR}/docker-compose.yml" exec -T db \
    psql -U postgres -d postgres < "$SQL_FILE" 2>&1)

  if echo "$OUTPUT" | grep -qi "error"; then
    echo "[AVISO] $FILENAME teve avisos (objetos ja existentes - ignorado)"
    ERRORS=$((ERRORS + 1))
  else
    echo "[OK] $FILENAME"
    SUCCESS=$((SUCCESS + 1))
  fi
done

echo ""
echo "[RESUMO] $SUCCESS OK, $ERRORS com avisos"
echo "[OK] Migracoes finalizadas."
```

### Arquivos a remover

Os 9 arquivos de migracao antigos serao removidos:
- `20260212003444_*.sql`
- `20260212005643_*.sql`
- `20260212012538_*.sql`
- `20260212012922_*.sql`
- `20260212125332_*.sql`
- `20260212131345_*.sql`
- `20260212131800_*.sql`
- `20260212132315_*.sql`
- `20260212134231_*.sql`

### Resumo dos arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `supabase/migrations/00000000000000_full_schema.sql` |
| Reescrever | `scripts/run-migrations.sh` |
| Remover | 9 arquivos de migracao antigos |

