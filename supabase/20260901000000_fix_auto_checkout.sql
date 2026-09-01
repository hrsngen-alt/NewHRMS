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
  marketing_policy RECORD;
BEGIN
  -- Get the Marketing policy settings to use as fallback
  SELECT * INTO marketing_policy FROM public.attendance_policies WHERE name = 'Marketing' LIMIT 1;

  -- Loop through all active attendance records where check_out is null
  FOR rec IN 
    SELECT 
      a.id, 
      a.check_in, 
      a.employee_id, 
      e.full_name, 
      e.department, 
      p.auto_checkout_after_minutes,
      p.auto_checkout_enabled
    FROM public.attendance a
    JOIN public.employees e ON a.employee_id = e.id
    LEFT JOIN public.attendance_policies p ON e.attendance_policy_id = p.id
    WHERE a.check_out IS NULL
  LOOP
    -- Respect the policy if one is assigned, otherwise fallback to department rules
    IF rec.auto_checkout_enabled IS NOT NULL THEN
      IF rec.auto_checkout_enabled = TRUE THEN
        policy_minutes := COALESCE(rec.auto_checkout_after_minutes, 120);
      ELSE
        policy_minutes := 0;
      END IF;
    ELSIF LOWER(rec.department) = 'marketing' AND marketing_policy.id IS NOT NULL THEN
      IF marketing_policy.auto_checkout_enabled = TRUE THEN
        policy_minutes := COALESCE(marketing_policy.auto_checkout_after_minutes, 120);
      ELSE
        policy_minutes := 0;
      END IF;
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
    END IF;
  END LOOP;
END;
$$;
