
-- Create campaign_smart_links table
CREATE TABLE public.campaign_smart_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  slug text NOT NULL,
  max_members_per_group integer NOT NULL DEFAULT 200,
  group_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_smart_links_slug_unique UNIQUE (slug)
);

-- Enable RLS
ALTER TABLE public.campaign_smart_links ENABLE ROW LEVEL SECURITY;

-- RLS: users manage their own smart links
CREATE POLICY "Users manage own smart links"
  ON public.campaign_smart_links
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: public read for the redirect edge function (service role reads, but anon needs select for slug lookup)
CREATE POLICY "Public can read active smart links by slug"
  ON public.campaign_smart_links
  FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_campaign_smart_links_updated_at
  BEFORE UPDATE ON public.campaign_smart_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
