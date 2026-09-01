SELECT 
  '2026-09-01 10:00:00+00'::timestamptz as orig,
  ('2026-09-01 10:00:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') as local_ts,
  (date_trunc('day', '2026-09-01 10:00:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata')) as start_of_day_local,
  (date_trunc('day', '2026-09-01 10:00:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') + interval '23 hours 59 minutes') as eod_local,
  (date_trunc('day', '2026-09-01 10:00:00+00'::timestamptz AT TIME ZONE 'Asia/Kolkata') + interval '23 hours 59 minutes') AT TIME ZONE 'Asia/Kolkata' as eod_tz
