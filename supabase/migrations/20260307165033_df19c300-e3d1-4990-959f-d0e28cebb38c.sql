-- Fix: recalculate next_run_at using explicit +3h arithmetic (no AT TIME ZONE)

-- 1. DAILY
UPDATE scheduled_messages
SET next_run_at = CASE
  WHEN (CURRENT_DATE + (COALESCE(content->>'runTime','08:00') || ':00')::interval + interval '3 hours') > now()
  THEN CURRENT_DATE + (COALESCE(content->>'runTime','08:00') || ':00')::interval + interval '3 hours'
  ELSE CURRENT_DATE + interval '1 day' + (COALESCE(content->>'runTime','08:00') || ':00')::interval + interval '3 hours'
END,
processing_started_at = NULL
WHERE is_active = true AND schedule_type = 'daily';

-- 2. WEEKLY
UPDATE scheduled_messages sm
SET next_run_at = sub.next_fire, processing_started_at = NULL
FROM (
  SELECT sm2.id, MIN(
    d + (COALESCE(sm2.content->>'runTime','08:00') || ':00')::interval + interval '3 hours'
  ) AS next_fire
  FROM scheduled_messages sm2
  CROSS JOIN generate_series(
    CURRENT_DATE,
    CURRENT_DATE + 13,
    '1 day'::interval
  ) AS d
  CROSS JOIN LATERAL (
    SELECT array_agg(e::int) AS days
    FROM jsonb_array_elements_text(COALESCE(sm2.content->'weekDays', '[1]'::jsonb)) AS e
  ) wd
  WHERE sm2.is_active = true AND sm2.schedule_type = 'weekly'
    AND EXTRACT(DOW FROM d)::int = ANY(wd.days)
    AND (d + (COALESCE(sm2.content->>'runTime','08:00') || ':00')::interval + interval '3 hours') > now()
  GROUP BY sm2.id
) sub
WHERE sm.id = sub.id AND sub.next_fire IS NOT NULL;

-- 3. MONTHLY
UPDATE scheduled_messages
SET next_run_at = CASE
  WHEN (
    make_date(
      EXTRACT(YEAR FROM (now() - interval '3 hours'))::int,
      EXTRACT(MONTH FROM (now() - interval '3 hours'))::int,
      LEAST(COALESCE((content->>'monthDay')::int, 1), 28)
    ) + (COALESCE(content->>'runTime','08:00') || ':00')::interval + interval '3 hours'
  ) > now()
  THEN
    make_date(
      EXTRACT(YEAR FROM (now() - interval '3 hours'))::int,
      EXTRACT(MONTH FROM (now() - interval '3 hours'))::int,
      LEAST(COALESCE((content->>'monthDay')::int, 1), 28)
    ) + (COALESCE(content->>'runTime','08:00') || ':00')::interval + interval '3 hours'
  ELSE
    make_date(
      EXTRACT(YEAR FROM (now() - interval '3 hours' + interval '1 month'))::int,
      EXTRACT(MONTH FROM (now() - interval '3 hours' + interval '1 month'))::int,
      LEAST(COALESCE((content->>'monthDay')::int, 1), 28)
    ) + (COALESCE(content->>'runTime','08:00') || ':00')::interval + interval '3 hours'
END,
processing_started_at = NULL
WHERE is_active = true AND schedule_type = 'monthly';

-- 4. CUSTOM
UPDATE scheduled_messages sm
SET next_run_at = sub.next_fire, processing_started_at = NULL
FROM (
  SELECT cands.id, MIN(cands.next_ts) AS next_fire FROM (
    SELECT sm3.id,
      make_date(
        EXTRACT(YEAR FROM (now() - interval '3 hours'))::int,
        EXTRACT(MONTH FROM (now() - interval '3 hours'))::int,
        LEAST(e::int, 28)
      ) + (COALESCE(sm3.content->>'runTime','08:00') || ':00')::interval + interval '3 hours' AS next_ts
    FROM scheduled_messages sm3
    CROSS JOIN jsonb_array_elements_text(COALESCE(sm3.content->'customDays', '[]'::jsonb)) AS e
    WHERE sm3.is_active = true AND sm3.schedule_type = 'custom'
    UNION ALL
    SELECT sm4.id,
      make_date(
        EXTRACT(YEAR FROM (now() - interval '3 hours' + interval '1 month'))::int,
        EXTRACT(MONTH FROM (now() - interval '3 hours' + interval '1 month'))::int,
        LEAST(e::int, 28)
      ) + (COALESCE(sm4.content->>'runTime','08:00') || ':00')::interval + interval '3 hours' AS next_ts
    FROM scheduled_messages sm4
    CROSS JOIN jsonb_array_elements_text(COALESCE(sm4.content->'customDays', '[]'::jsonb)) AS e
    WHERE sm4.is_active = true AND sm4.schedule_type = 'custom'
  ) cands
  WHERE cands.next_ts > now()
  GROUP BY cands.id
) sub
WHERE sm.id = sub.id AND sub.next_fire IS NOT NULL;