-- Fix end_of_day_auto_checkout to correctly calculate 11:59 PM IST in UTC

CREATE OR REPLACE FUNCTION public.end_of_day_auto_checkout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  checkout_time TIMESTAMPTZ;
  worked_hours NUMERIC(5,2);
BEGIN
  FOR rec IN 
    SELECT 
      a.id, 
      a.check_in, 
      a.employee_id,
      e.user_id,
      e.full_name, 
      e.department
    FROM public.attendance a
    JOIN public.employees e ON a.employee_id = e.id
    WHERE a.check_out IS NULL
  LOOP
    -- Calculate 11:59 PM IST of the check_in day unambiguously.
    -- 1) get local date
    -- 2) convert local date's midnight back to TIMESTAMPTZ (UTC)
    -- 3) add 23 hours 59 mins
    checkout_time := (date_trunc('day', rec.check_in AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') + interval '23 hours 59 minutes';
    
    -- If the current time has passed the calculated 11:59 PM checkout time, process it
    IF now() >= checkout_time THEN
      worked_hours := ROUND((EXTRACT(EPOCH FROM (checkout_time - rec.check_in)) / 3600.0)::NUMERIC, 2);
      
      -- Ensure hours_worked is not negative
      IF worked_hours < 0 THEN
        worked_hours := 0;
      END IF;

      UPDATE public.attendance
      SET 
        check_out = checkout_time,
        hours_worked = worked_hours,
        check_out_type = 'Forget Check Out'
      WHERE id = rec.id;
      
      -- Send notification
      IF rec.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (
          user_id, 
          title, 
          message, 
          type, 
          link
        ) VALUES (
          rec.user_id,
          'Forget Check Out',
          'forget check out',
          'warning',
          '/attendance'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Fix the bad records that were mistakenly saved as 23:59:00 UTC
UPDATE public.attendance
SET check_out = check_out - interval '5 hours 30 minutes',
    hours_worked = ROUND((EXTRACT(EPOCH FROM ((check_out - interval '5 hours 30 minutes') - check_in)) / 3600.0)::NUMERIC, 2)
WHERE check_out_type = 'Forget Check Out'
  AND EXTRACT(HOUR FROM check_out AT TIME ZONE 'UTC') = 23
  AND EXTRACT(MINUTE FROM check_out AT TIME ZONE 'UTC') = 59;
