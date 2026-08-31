-- ====================================================================
-- END OF DAY CHECKOUT
-- Auto checkout employees who forgot to checkout at 11:59 PM
-- ====================================================================

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
    -- Calculate 11:59 PM of the day the employee checked in, relative to India Standard Time (IST)
    checkout_time := (date_trunc('day', rec.check_in AT TIME ZONE 'Asia/Kolkata') + interval '23 hours 59 minutes') AT TIME ZONE 'Asia/Kolkata';
    
    -- If the current time has passed the calculated 11:59 PM checkout time, process it
    IF now() >= checkout_time THEN
      worked_hours := ROUND((EXTRACT(EPOCH FROM (checkout_time - rec.check_in)) / 3600.0)::NUMERIC, 2);
      
      -- Ensure hours_worked is not negative (if check-in was exactly at or after 11:59 PM)
      IF worked_hours < 0 THEN
        worked_hours := 0;
      END IF;

      UPDATE public.attendance
      SET 
        check_out = checkout_time,
        hours_worked = worked_hours,
        check_out_type = 'Forget Check Out'
      WHERE id = rec.id;
      
      -- Send notification to the user's phone/app if they have a user account linked
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

-- Schedule the function to run daily at 23:59 using pg_cron (if extension is enabled)
DO $$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- First unschedule if it exists to avoid duplicates during multiple runs
    BEGIN
      PERFORM cron.unschedule('end_of_day_checkout');
    EXCEPTION WHEN OTHERS THEN
      -- ignore if it doesn't exist
    END;
    
    -- Schedule job to run at 23:59 every day (database local time)
    PERFORM cron.schedule('end_of_day_checkout', '59 23 * * *', 'SELECT public.end_of_day_auto_checkout();');
  ELSE
    RAISE NOTICE 'pg_cron extension is not installed. You will need to trigger end_of_day_auto_checkout() manually or via an external scheduler.';
  END IF;
END
$$;
