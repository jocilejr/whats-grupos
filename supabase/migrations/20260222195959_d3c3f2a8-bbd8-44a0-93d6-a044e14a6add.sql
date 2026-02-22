
-- =============================================
-- Recriar todas as RLS policies como PERMISSIVE
-- =============================================

-- 1. user_roles
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. user_plans
DROP POLICY IF EXISTS "Users can read own plan" ON public.user_plans;
DROP POLICY IF EXISTS "Admins can manage all plans" ON public.user_plans;

CREATE POLICY "Users can read own plan"
  ON public.user_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all plans"
  ON public.user_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. global_config
DROP POLICY IF EXISTS "Admins can manage global config" ON public.global_config;

CREATE POLICY "Admins can manage global config"
  ON public.global_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. api_configs
DROP POLICY IF EXISTS "Users manage own api_configs" ON public.api_configs;

CREATE POLICY "Users manage own api_configs"
  ON public.api_configs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. campaigns
DROP POLICY IF EXISTS "Users manage own campaigns" ON public.campaigns;

CREATE POLICY "Users manage own campaigns"
  ON public.campaigns FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. message_logs
DROP POLICY IF EXISTS "Users manage own logs" ON public.message_logs;

CREATE POLICY "Users manage own logs"
  ON public.message_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. message_queue
DROP POLICY IF EXISTS "Users manage own queue items" ON public.message_queue;

CREATE POLICY "Users manage own queue items"
  ON public.message_queue FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 9. message_templates
DROP POLICY IF EXISTS "Users manage own templates" ON public.message_templates;

CREATE POLICY "Users manage own templates"
  ON public.message_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. scheduled_messages
DROP POLICY IF EXISTS "Users manage own schedules" ON public.scheduled_messages;

CREATE POLICY "Users manage own schedules"
  ON public.scheduled_messages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
