
-- group_participant_events: leitura para authenticated, escrita para service_role
GRANT SELECT ON public.group_participant_events TO anon, authenticated;
GRANT ALL ON public.group_participant_events TO service_role;

-- group_stats: leitura e escrita para authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_stats TO authenticated;
GRANT ALL ON public.group_stats TO service_role;
