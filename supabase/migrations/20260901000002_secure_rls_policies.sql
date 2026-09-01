-- Disable previously wide-open policies
DROP POLICY IF EXISTS "Allow all authenticated on employees" ON public.employees;
DROP POLICY IF EXISTS "Allow all authenticated on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow all authenticated on leaves" ON public.leaves;
DROP POLICY IF EXISTS "Allow all authenticated on payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Allow all authenticated on payslips" ON public.payslips;

-- Enable RLS on all these tables just in case they were disabled
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- 1. Employees Table
CREATE POLICY "Admins/Managers can do everything on employees" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can view their own record" ON public.employees
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Employees can update their own record" ON public.employees
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Attendance Table
CREATE POLICY "Admins/Managers can do everything on attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can view their own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can insert their own attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can update their own attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- 3. Leaves Table
CREATE POLICY "Admins/Managers can do everything on leaves" ON public.leaves
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can view their own leaves" ON public.leaves
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can insert their own leaves" ON public.leaves
  FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can update their own leaves" ON public.leaves
  FOR UPDATE TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- 4. Payroll Runs
CREATE POLICY "Admins/Managers can do everything on payroll_runs" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 5. Payslips
CREATE POLICY "Admins/Managers can do everything on payslips" ON public.payslips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can view their own payslips" ON public.payslips
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
