
-- Recalculate next_run_at for ALL active recurring messages (not just stale ones)

-- 1. DAILY
UPDATE scheduled_messages
SET next_run_at = (
  (now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day'
  + (COALESCE(content->>'runTime', '08:00') || ':00')::interval
) AT TIME ZONE 'America/Sao_Paulo',
processing_started_at = NULL
WHERE is_active = true AND schedule_type = 'daily';

-- 2. WEEKLY
UPDATE scheduled_messages sm
SET next_run_at = lat.next_fire, processing_started_at = NULL
FROM scheduled_messages sm2
CROSS JOIN LATERAL (
  SELECT MIN(
    (d + (COALESCE(sm2.content->>'runTime', '08:00') || ':00')::interval) AT TIME ZONE 'America/Sao_Paulo'
  ) AS next_fire
  FROM generate_series(
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date + 13,
    '1 day'::interval
  ) AS d
  CROSS JOIN LATERAL (
    SELECT array_agg(e::int) AS days
    FROM jsonb_array_elements_text(COALESCE(sm2.content->'weekDays', '[1]'::jsonb)) AS e
  ) wd
  WHERE EXTRACT(DOW FROM d)::int = ANY(wd.days)
    AND (d + (COALESCE(sm2.content->>'runTime', '08:00') || ':00')::interval) AT TIME ZONE 'America/Sao_Paulo' > now()
) lat
WHERE sm.id = sm2.id
  AND sm2.is_active = true AND sm2.schedule_type = 'weekly'
  AND lat.next_fire IS NOT NULL;

-- 3. MONTHLY
UPDATE scheduled_messages
SET next_run_at = CASE
  WHEN (
    make_date(
      EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Sao_Paulo')::int,
      EXTRACT(MONTH FROM now() AT TIME ZONE 'America/Sao_Paulo')::int,
      LEAST(COALESCE((content->>'monthDay')::int, 1), 28)
    ) + (COALESCE(content->>'runTime', '08:00') || ':00')::interval
  ) AT TIME ZONE 'America/Sao_Paulo' > now()
  THEN (
    make_date(
      EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Sao_Paulo')::int,
      EXTRACT(MONTH FROM now() AT TIME ZONE 'America/Sao_Paulo')::int,
      LEAST(COALESCE((content->>'monthDay')::int, 1), 28)
    ) + (COALESCE(content->>'runTime', '08:00') || ':00')::interval
  ) AT TIME ZONE 'America/Sao_Paulo'
  ELSE (
    make_date(
      EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo' + interval '1 month'))::int,
      EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Sao_Paulo' + interval '1 month'))::int,
      LEAST(COALESCE((content->>'monthDay')::int, 1), 28)
    ) + (COALESCE(content->>'runTime', '08:00') || ':00')::interval
  ) AT TIME ZONE 'America/Sao_Paulo'
END,
processing_started_at = NULL
WHERE is_active = true AND schedule_type = 'monthly';

-- 4. CUSTOM
UPDATE scheduled_messages sm
SET next_run_at = lat.next_fire, processing_started_at = NULL
FROM scheduled_messages sm2
CROSS JOIN LATERAL (
  SELECT MIN(next_ts) AS next_fire FROM (
    SELECT (
      make_date(
        EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Sao_Paulo')::int,
        EXTRACT(MONTH FROM now() AT TIME ZONE 'America/Sao_Paulo')::int,
        LEAST(e::int, 28)
      ) + (COALESCE(sm2.content->>'runTime', '08:00') || ':00')::interval
    ) AT TIME ZONE 'America/Sao_Paulo' AS next_ts
    FROM jsonb_array_elements_text(COALESCE(sm2.content->'customDays', '[]'::jsonb)) AS e
    UNION ALL
    SELECT (
      make_date(
        EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo' + interval '1 month'))::int,
        EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Sao_Paulo' + interval '1 month'))::int,
        LEAST(e::int, 28)
      ) + (COALESCE(sm2.content->>'runTime', '08:00') || ':00')::interval
    ) AT TIME ZONE 'America/Sao_Paulo' AS next_ts
    FROM jsonb_array_elements_text(COALESCE(sm2.content->'customDays', '[]'::jsonb)) AS e
  ) cands
  WHERE next_ts > now()
) lat
WHERE sm.id = sm2.id
  AND sm2.is_active = true AND sm2.schedule_type = 'custom'
  AND lat.next_fire IS NOT NULL;
