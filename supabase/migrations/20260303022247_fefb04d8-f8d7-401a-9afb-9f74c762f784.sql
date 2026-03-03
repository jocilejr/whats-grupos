CREATE OR REPLACE FUNCTION public.get_admin_global_config()
RETURNS TABLE (
  id uuid,
  baileys_api_key text,
  openai_api_key text,
  queue_delay_seconds integer,
  baileys_api_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT gc.id, gc.baileys_api_key, gc.openai_api_key, gc.queue_delay_seconds, gc.baileys_api_url
  FROM public.global_config gc
  ORDER BY gc.created_at ASC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_global_config(
  _openai_api_key text,
  _baileys_api_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO _id
  FROM public.global_config
  ORDER BY created_at ASC
  LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.global_config (openai_api_key, baileys_api_key)
    VALUES (COALESCE(_openai_api_key, ''), COALESCE(_baileys_api_key, ''))
    RETURNING id INTO _id;
  ELSE
    UPDATE public.global_config
    SET
      openai_api_key = COALESCE(_openai_api_key, ''),
      baileys_api_key = COALESCE(_baileys_api_key, ''),
      updated_at = now()
    WHERE id = _id;
  END IF;

  RETURN _id;
END;
$$;