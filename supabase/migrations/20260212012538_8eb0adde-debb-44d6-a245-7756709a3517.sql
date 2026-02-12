
-- 1. Adicionar instance_name nas tabelas
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS instance_name text;
ALTER TABLE public.scheduled_messages ADD COLUMN IF NOT EXISTS instance_name text;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS instance_name text;

-- 2. Criar bucket de storage para midias
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: usuarios autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media');

-- RLS: qualquer um pode ler (publico)
CREATE POLICY "Public can read media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- RLS: usuarios podem deletar seus proprios arquivos
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media');
