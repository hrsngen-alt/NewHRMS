-- ==============================================================================
-- Migration: Restrict Reporting Managers to Team Doctor Visits Only
-- ==============================================================================

ALTER TABLE public.doctor_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "HR and Admin can view all visits" ON public.doctor_visits;
DROP POLICY IF EXISTS "HR and Admin can update all visits" ON public.doctor_visits;
DROP POLICY IF EXISTS "Employees and Managers can view team visits" ON public.doctor_visits;
DROP POLICY IF EXISTS "Employees can view own visits" ON public.doctor_visits;

-- 1. Admins full access to all doctor visits
CREATE POLICY "Admins can do everything on doctor_visits" ON public.doctor_visits
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

-- 2. Employees and Reporting Managers can view only own & reporting team's visits
CREATE POLICY "Employees and Managers can view team visits" ON public.doctor_visits
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR employee_id IN (SELECT id FROM public.get_reporting_team_employee_ids(auth.uid()))
  );
