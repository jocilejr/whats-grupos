
-- 1. Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Tabela user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função has_role (security definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS para user_roles: somente admin lê/gerencia
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5. Tabela user_plans
CREATE TABLE public.user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  max_instances integer NOT NULL DEFAULT 1,
  max_messages_per_hour integer NOT NULL DEFAULT 100,
  max_campaigns integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all plans"
  ON public.user_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own plan"
  ON public.user_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Tabela global_config (Evolution API global)
CREATE TABLE public.global_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_api_url text NOT NULL DEFAULT '',
  evolution_api_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage global config"
  ON public.global_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_global_config_updated_at
  BEFORE UPDATE ON public.global_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Seed: inserir role admin para jocilejun@gmail.com se já existir
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'jocilejun@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Seed: inserir plano ilimitado para o admin
INSERT INTO public.user_plans (user_id, max_instances, max_messages_per_hour, max_campaigns)
SELECT id, 9999, 9999, 9999 FROM auth.users WHERE email = 'jocilejun@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 9. Inserir config global vazia (admin irá configurar)
INSERT INTO public.global_config (evolution_api_url, evolution_api_key) VALUES ('', '')
ON CONFLICT DO NOTHING;
