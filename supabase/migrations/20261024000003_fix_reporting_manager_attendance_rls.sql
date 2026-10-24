-- ==============================================================================
-- Migration: Fix Reporting Manager Attendance & Team Employees RLS
-- ==============================================================================

-- 1. Helper function (SECURITY DEFINER) to safely get reporting team employee IDs
-- Bypasses recursive RLS locks on employees and handles case/whitespace matching.
CREATE OR REPLACE FUNCTION public.get_reporting_team_employee_ids(_user_id UUID)
RETURNS TABLE(id UUID) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_full_names TEXT[];
BEGIN
  -- Collect full_name(s) associated with this user (by user_id or auth email)
  SELECT ARRAY_AGG(LOWER(TRIM(full_name)))
  INTO v_full_names
  FROM public.employees
  WHERE user_id = _user_id
     OR (email IS NOT NULL AND email = (SELECT email FROM auth.users WHERE auth.users.id = _user_id));

  -- Return direct reports and manager self
  RETURN QUERY
  SELECT e.id
  FROM public.employees e
  WHERE e.user_id = _user_id
     OR (v_full_names IS NOT NULL AND LOWER(TRIM(e.reporting_manager)) = ANY(v_full_names));
END;
$$;

-- 2. Drop existing restrictive attendance policies
DROP POLICY IF EXISTS "Managers can view team and own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Managers can update team and own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can do everything on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins/Managers can do everything on attendance" ON public.attendance;

-- 3. Admins have unrestricted access on attendance
CREATE POLICY "Admins can do everything on attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Managers & Reporting Managers can view their team's and their own attendance
CREATE POLICY "Managers can view team and own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );

-- 5. Managers & Reporting Managers can update their team's and their own attendance
CREATE POLICY "Managers can update team and own attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );

-- 6. Ensure Managers can also SELECT their team from public.employees
DROP POLICY IF EXISTS "Managers can view team employees" ON public.employees;
CREATE POLICY "Managers can view team employees" ON public.employees
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );
