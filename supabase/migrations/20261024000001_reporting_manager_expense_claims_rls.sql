-- ==============================================================================
-- Migration: Restrict Manager Expense Claims RLS to Direct Reporting Team & Self
-- ==============================================================================

-- Drop old wide-open/department-level policies for expense_claims
DROP POLICY IF EXISTS "Department Managers can view expenses for their department" ON public.expense_claims;
DROP POLICY IF EXISTS "Department Managers can update expenses for their department" ON public.expense_claims;
DROP POLICY IF EXISTS "View expense_claims policy" ON public.expense_claims;
DROP POLICY IF EXISTS "Create expense_claims policy" ON public.expense_claims;
DROP POLICY IF EXISTS "Update expense_claims policy" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can manage own expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can create expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can view own expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Allow all authenticated on expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Admins can do everything on expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Managers can view team and own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Managers can update team and own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Managers can insert team and own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can view own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can create own expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can update own expense_claims" ON public.expense_claims;

-- Ensure RLS is active on expense_claims
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

-- 1. Admins have unrestricted access to all expense claims
CREATE POLICY "Admins can do everything on expense_claims" ON public.expense_claims
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (SELECT public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (SELECT public.has_role(auth.uid(), 'admin'))
  );

-- 2. Managers can only SELECT expense claims for their direct reporting team and their own claims
CREATE POLICY "Managers can view team and own expense_claims" ON public.expense_claims
  FOR SELECT TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
      OR (SELECT public.has_role(auth.uid(), 'manager'))
    ) AND (
      employee_id IN (
        SELECT id FROM public.employees
        WHERE reporting_manager = (SELECT full_name FROM public.employees WHERE user_id = auth.uid())
           OR user_id = auth.uid()
      )
    )
  );

-- 3. Managers can UPDATE expense claims for their direct reports and their own claims (e.g. to verify or add remarks)
CREATE POLICY "Managers can update team and own expense_claims" ON public.expense_claims
  FOR UPDATE TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
      OR (SELECT public.has_role(auth.uid(), 'manager'))
    ) AND (
      employee_id IN (
        SELECT id FROM public.employees
        WHERE reporting_manager = (SELECT full_name FROM public.employees WHERE user_id = auth.uid())
           OR user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
      OR (SELECT public.has_role(auth.uid(), 'manager'))
    ) AND (
      employee_id IN (
        SELECT id FROM public.employees
        WHERE reporting_manager = (SELECT full_name FROM public.employees WHERE user_id = auth.uid())
           OR user_id = auth.uid()
      )
    )
  );

-- 4. Managers can INSERT expense claims for their direct reports and themselves
CREATE POLICY "Managers can insert team and own expense_claims" ON public.expense_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
      OR (SELECT public.has_role(auth.uid(), 'manager'))
    ) AND (
      employee_id IN (
        SELECT id FROM public.employees
        WHERE reporting_manager = (SELECT full_name FROM public.employees WHERE user_id = auth.uid())
           OR user_id = auth.uid()
      )
    )
  );

-- 5. Regular employees can view and create/update only their own expense claims
CREATE POLICY "Employees can view own expense_claims" ON public.expense_claims
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

CREATE POLICY "Employees can create own expense_claims" ON public.expense_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

CREATE POLICY "Employees can update own expense_claims" ON public.expense_claims
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  )
  WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );
