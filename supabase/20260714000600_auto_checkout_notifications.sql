-- ====================================================================
-- ATTENDANCE NOTIFICATION UPDATE
-- Sends a notification to the user when they are automatically checked out
-- ====================================================================

CREATE OR REPLACE FUNCTION public.process_auto_checkouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  policy_minutes INT;
  checkout_time TIMESTAMPTZ;
  worked_hours NUMERIC(5,2);
BEGIN
  -- Loop through all active attendance records where check_out is null
  FOR rec IN 
    SELECT 
      a.id, 
      a.check_in, 
      a.employee_id,
      e.user_id,
      e.full_name, 
      e.department, 
      p.auto_checkout_after_minutes,
      p.auto_checkout_enabled
    FROM public.attendance a
    JOIN public.employees e ON a.employee_id = e.id
    LEFT JOIN public.attendance_policies p ON e.attendance_policy_id = p.id
    WHERE a.check_out IS NULL
  LOOP
    -- Default/fallback check:
    -- If a policy has auto_checkout_enabled OR if the department is 'Marketing' (and no explicit policy is assigned)
    IF rec.auto_checkout_enabled = TRUE THEN
      policy_minutes := COALESCE(rec.auto_checkout_after_minutes, 120);
    ELSIF LOWER(rec.department) = 'marketing' THEN
      policy_minutes := 120;
    ELSE
      policy_minutes := 0;
    END IF;
      
    -- If auto checkout is enabled (minutes > 0) and the check-in time is older than that duration
    IF policy_minutes > 0 AND rec.check_in <= now() - (policy_minutes || ' minutes')::INTERVAL THEN
      checkout_time := rec.check_in + (policy_minutes || ' minutes')::INTERVAL;
      worked_hours := ROUND((policy_minutes::NUMERIC / 60.0), 2);
      
      UPDATE public.attendance
      SET 
        check_out = checkout_time,
        hours_worked = worked_hours,
        check_out_type = 'Automatic'
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
          'Auto Checkout',
          'You were automatically checked out. Please check in again.',
          'warning',
          '/attendance'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;
