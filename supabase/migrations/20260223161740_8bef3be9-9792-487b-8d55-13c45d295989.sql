ALTER TABLE public.group_stats
ADD CONSTRAINT group_stats_user_group_date_unique
UNIQUE (user_id, group_id, snapshot_date);