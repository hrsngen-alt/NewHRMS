-- ====================================================================
-- ATTENDANCE POLICY SYSTEM MIGRATION
-- Adds configurable attendance policies, auto checkout functionality,
-- and tracks additional geolocation, address, and session type metadata.
-- ====================================================================

-- 1. Create attendance policies table
CREATE TABLE IF NOT EXISTS public.attendance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    auto_checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    auto_checkout_after_minutes INTEGER NOT NULL DEFAULT 120,
    qr_attendance_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Insert initial policies if they do not exist
INSERT INTO public.attendance_policies (name, auto_checkout_enabled, auto_checkout_after_minutes, qr_attendance_enabled)
VALUES 
  ('Inhouse', FALSE, 0, TRUE),
  ('Marketing', TRUE, 120, TRUE)
ON CONFLICT (name) DO NOTHING;

-- 3. Add attendance_policy_id to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS attendance_policy_id UUID REFERENCES public.attendance_policies(id) ON DELETE SET NULL;

-- 4. Add additional reporting columns to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_address TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_address TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_type TEXT DEFAULT 'Manual';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS department TEXT;

-- 5. Drop the old UNIQUE(employee_id, date) constraint to allow multiple punches per day for Marketing
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_date_key;

-- 6. Enable RLS on attendance_policies table
ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies for attendance_policies
DROP POLICY IF EXISTS "Allow read access to attendance_policies for all authenticated users" ON public.attendance_policies;
CREATE POLICY "Allow read access to attendance_policies for all authenticated users" 
ON public.attendance_policies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manage access to attendance_policies for admins" ON public.attendance_policies;
CREATE POLICY "Allow manage access to attendance_policies for admins" 
ON public.attendance_policies FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin')) 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Create postgres function to process automatic checkouts
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
    END IF;
  END LOOP;
END;
$$;
