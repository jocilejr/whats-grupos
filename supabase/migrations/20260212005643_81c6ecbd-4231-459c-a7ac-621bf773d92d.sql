
-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_config_id UUID NOT NULL REFERENCES public.api_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  group_ids TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users manage own campaigns"
ON public.campaigns
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add campaign_id to scheduled_messages
ALTER TABLE public.scheduled_messages
ADD COLUMN campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;
