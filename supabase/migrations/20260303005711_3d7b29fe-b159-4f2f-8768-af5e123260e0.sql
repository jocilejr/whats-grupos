
-- Create webhook_configs table
CREATE TABLE public.webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  webhook_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  secret text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

-- Users manage own webhooks (PERMISSIVE)
CREATE POLICY "Users manage own webhook_configs"
ON public.webhook_configs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins manage all webhooks (PERMISSIVE)
CREATE POLICY "Admins manage all webhook_configs"
ON public.webhook_configs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_webhook_configs_updated_at
BEFORE UPDATE ON public.webhook_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
