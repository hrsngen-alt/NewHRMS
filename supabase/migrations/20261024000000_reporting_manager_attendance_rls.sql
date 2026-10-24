-- ==============================================================================
-- Migration: Restrict Manager Attendance RLS to Reporting Team and Self
-- ==============================================================================

-- Drop the wide-open attendance policies for managers
DROP POLICY IF EXISTS "Admins/Managers can do everything on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Department Managers can view attendance for their department" ON public.attendance;
DROP POLICY IF EXISTS "Department Managers can update attendance for their department" ON public.attendance;
DROP POLICY IF EXISTS "Managers can view team and own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Managers can update team and own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can do everything on attendance" ON public.attendance;

-- 1. Admins have full access to all attendance records
CREATE POLICY "Admins can do everything on attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Managers can only SELECT attendance for their direct reporting team and their own record
CREATE POLICY "Managers can view team and own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND (
      employee_id IN (
        SELECT id FROM public.employees
        WHERE reporting_manager = (SELECT full_name FROM public.employees WHERE user_id = auth.uid())
           OR user_id = auth.uid()
      )
    )
  );

-- 3. Managers can UPDATE attendance for their direct reporting team and their own record
CREATE POLICY "Managers can update team and own attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND (
      employee_id IN (
        SELECT id FROM public.employees
        WHERE reporting_manager = (SELECT full_name FROM public.employees WHERE user_id = auth.uid())
           OR user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager') AND (
      employee_id IN (
        SELECT id FROM public.employees
        WHERE reporting_manager = (SELECT full_name FROM public.employees WHERE user_id = auth.uid())
           OR user_id = auth.uid()
      )
    )
  );
