
-- Table to track clicks on smart links
CREATE TABLE public.smart_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_link_id uuid NOT NULL REFERENCES public.campaign_smart_links(id) ON DELETE CASCADE,
  group_id text NOT NULL,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_smart_link_clicks_link_group ON public.smart_link_clicks(smart_link_id, group_id);

-- Enable RLS
ALTER TABLE public.smart_link_clicks ENABLE ROW LEVEL SECURITY;

-- Owner of the smart link can read clicks
CREATE POLICY "Smart link owner can read clicks"
ON public.smart_link_clicks
FOR SELECT
USING (
  smart_link_id IN (
    SELECT id FROM public.campaign_smart_links WHERE user_id = auth.uid()
  )
);
