-- ==============================================================================
-- Migration: Fix Reporting Manager Attendance, Expense Claims, Leaves & Employees RLS
-- ==============================================================================

-- 1. Helper function (SECURITY DEFINER) to safely get all reporting team employee IDs
-- Bypasses recursive RLS locks on employees and handles case/whitespace/identifier matching.
CREATE OR REPLACE FUNCTION public.get_reporting_team_employee_ids(_user_id UUID)
RETURNS TABLE(id UUID) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_names TEXT[];
  v_ids TEXT[];
  v_codes TEXT[];
  v_emails TEXT[];
BEGIN
  -- 1. Gather all possible identifiers of the logged in user / manager:
  SELECT 
    ARRAY_AGG(LOWER(TRIM(e.full_name))) FILTER (WHERE e.full_name IS NOT NULL AND TRIM(e.full_name) <> ''),
    ARRAY_AGG(e.id::TEXT) FILTER (WHERE e.id IS NOT NULL),
    ARRAY_AGG(LOWER(TRIM(e.employee_code))) FILTER (WHERE e.employee_code IS NOT NULL AND TRIM(e.employee_code) <> ''),
    ARRAY_AGG(LOWER(TRIM(e.email))) FILTER (WHERE e.email IS NOT NULL AND TRIM(e.email) <> '')
  INTO v_names, v_ids, v_codes, v_emails
  FROM public.employees e
  WHERE e.user_id = _user_id
     OR (e.email IS NOT NULL AND LOWER(TRIM(e.email)) = (SELECT LOWER(TRIM(email)) FROM auth.users WHERE auth.users.id = _user_id LIMIT 1))
     OR (e.full_name IS NOT NULL AND LOWER(TRIM(e.full_name)) = (SELECT LOWER(TRIM(full_name)) FROM public.profiles WHERE public.profiles.id = _user_id LIMIT 1));

  -- Fallback: If not found in employees, get name/email from profiles and auth.users
  IF v_names IS NULL OR array_length(v_names, 1) IS NULL THEN
    SELECT ARRAY_AGG(LOWER(TRIM(full_name))) FILTER (WHERE full_name IS NOT NULL AND TRIM(full_name) <> '')
    INTO v_names
    FROM public.profiles
    WHERE public.profiles.id = _user_id;
  END IF;

  IF v_emails IS NULL OR array_length(v_emails, 1) IS NULL THEN
    SELECT ARRAY_AGG(LOWER(TRIM(email))) FILTER (WHERE email IS NOT NULL AND TRIM(email) <> '')
    INTO v_emails
    FROM auth.users
    WHERE auth.users.id = _user_id;
  END IF;

  -- 2. Return direct reports AND manager's own employee record(s)
  RETURN QUERY
  SELECT e.id
  FROM public.employees e
  WHERE e.user_id = _user_id
     OR (v_ids IS NOT NULL AND e.id::TEXT = ANY(v_ids))
     OR (e.reporting_manager IS NOT NULL AND (
          (v_names IS NOT NULL AND LOWER(TRIM(e.reporting_manager)) = ANY(v_names))
       OR (v_ids IS NOT NULL AND LOWER(TRIM(e.reporting_manager)) = ANY(v_ids))
       OR (v_codes IS NOT NULL AND LOWER(TRIM(e.reporting_manager)) = ANY(v_codes))
       OR (v_emails IS NOT NULL AND LOWER(TRIM(e.reporting_manager)) = ANY(v_emails))
     ));
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_reporting_team_employee_ids(UUID) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- 2. EMPLOYEES TABLE POLICIES (Enables Directory, Team Filtering, & PostgREST Joins)
-- ------------------------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view team employees" ON public.employees;
DROP POLICY IF EXISTS "Employees and managers can view team and own employee record" ON public.employees;
DROP POLICY IF EXISTS "Admins/Managers can do everything on employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view their own record" ON public.employees;
DROP POLICY IF EXISTS "Employees can update their own record" ON public.employees;
DROP POLICY IF EXISTS "Allow all authenticated on employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can do everything on employees" ON public.employees;
DROP POLICY IF EXISTS "Employees and Managers can view employee directory" ON public.employees;

-- Admins full access
CREATE POLICY "Admins can do everything on employees" ON public.employees
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin')
  );

-- All authenticated users can view active employees directory (needed for joins & search)
CREATE POLICY "Employees and Managers can view employee directory" ON public.employees
  FOR SELECT TO authenticated
  USING (true);

-- Employees can update their own employee record
CREATE POLICY "Employees can update their own record" ON public.employees
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 3. ATTENDANCE TABLE POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view team attendance" ON public.attendance;
DROP POLICY IF EXISTS "Managers can update team attendance" ON public.attendance;
DROP POLICY IF EXISTS "Managers can view team and own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Managers can update team and own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Department Managers can view attendance for their department" ON public.attendance;
DROP POLICY IF EXISTS "Department Managers can update attendance for their department" ON public.attendance;
DROP POLICY IF EXISTS "Employees can view their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can insert their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can update their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can do everything on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins/Managers can do everything on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow all authenticated on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees and Managers can view team and own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees and Managers can insert team and own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees and Managers can update team and own attendance" ON public.attendance;

-- Admins full access
CREATE POLICY "Admins can do everything on attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin')
  );

-- Employees & Reporting Managers can view team and own attendance
CREATE POLICY "Employees and Managers can view team and own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );

-- Employees & Reporting Managers can insert attendance
CREATE POLICY "Employees and Managers can insert team and own attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );

-- Employees & Reporting Managers can update attendance
CREATE POLICY "Employees and Managers can update team and own attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );

-- ------------------------------------------------------------------------------
-- 4. EXPENSE CLAIMS TABLE POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view team expense claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Managers can update team expense claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Managers can insert team expense claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Managers can view team and own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Managers can update team and own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Managers can insert team and own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Department Managers can view expenses for their department" ON public.expense_claims;
DROP POLICY IF EXISTS "Department Managers can update expenses for their department" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can view own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can create own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can update own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can manage own expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can create expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can view own expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Admins can do everything on expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Allow all authenticated on expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "View expense_claims policy" ON public.expense_claims;
DROP POLICY IF EXISTS "Create expense_claims policy" ON public.expense_claims;
DROP POLICY IF EXISTS "Update expense_claims policy" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees and Managers can view team and own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees and Managers can insert team and own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees and Managers can update team and own expense_claims" ON public.expense_claims;

-- Admins full access
CREATE POLICY "Admins can do everything on expense_claims" ON public.expense_claims
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin')
  );

-- Employees & Reporting Managers can view team and own expenses
CREATE POLICY "Employees and Managers can view team and own expense_claims" ON public.expense_claims
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );

-- Employees & Reporting Managers can insert team and own expenses
CREATE POLICY "Employees and Managers can insert team and own expense_claims" ON public.expense_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );

-- Employees & Reporting Managers can update team and own expenses
CREATE POLICY "Employees and Managers can update team and own expense_claims" ON public.expense_claims
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );

-- ------------------------------------------------------------------------------
-- 5. LEAVES TABLE POLICIES (Enables Reporting Managers to View & Approve Team Leaves)
-- ------------------------------------------------------------------------------
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view and update team leaves" ON public.leaves;
CREATE POLICY "Managers can view and update team leaves" ON public.leaves
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );
