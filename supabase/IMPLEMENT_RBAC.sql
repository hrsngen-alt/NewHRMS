-- ================================================================
-- IMPLEMENT ROLE-BASED ACCESS CONTROL (RBAC)
-- IMPORTANT RUN INSTRUCTIONS:
-- 1. Highlight and run ONLY Line 10 (ALTER TYPE) first in your Supabase SQL Editor.
-- 2. Once that query completes, run the remaining lines of this script.
-- This is because Postgres does not allow using a new enum value in the same transaction block it was created.
-- ================================================================

-- Step 1: Run this line by itself first!
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- 2. Clean and define LEAVES RLS Policies
DROP POLICY IF EXISTS "Admins can manage all leaves" ON public.leaves;
DROP POLICY IF EXISTS "Employees can manage own leaves" ON public.leaves;
DROP POLICY IF EXISTS "Allow all authenticated on leaves" ON public.leaves;
DROP POLICY IF EXISTS "Managers can manage department leaves" ON public.leaves;
DROP POLICY IF EXISTS "View leaves policy" ON public.leaves;
DROP POLICY IF EXISTS "Create leaves policy" ON public.leaves;
DROP POLICY IF EXISTS "Update leaves policy" ON public.leaves;
DROP POLICY IF EXISTS "Delete leaves policy" ON public.leaves;

-- SELECT leaves
CREATE POLICY "View leaves policy" ON public.leaves FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
    AND employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.department = (SELECT me.department FROM public.employees me WHERE me.user_id = auth.uid())
    )
  )
  OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- INSERT leaves
CREATE POLICY "Create leaves policy" ON public.leaves FOR INSERT TO authenticated
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- UPDATE leaves
CREATE POLICY "Update leaves policy" ON public.leaves FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
    AND employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.department = (SELECT me.department FROM public.employees me WHERE me.user_id = auth.uid())
    )
  )
  OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
    AND employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.department = (SELECT me.department FROM public.employees me WHERE me.user_id = auth.uid())
    )
  )
  OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- DELETE leaves
CREATE POLICY "Delete leaves policy" ON public.leaves FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);


-- 3. Clean and define ATTENDANCE RLS Policies
DROP POLICY IF EXISTS "Admins can manage all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can manage own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow all authenticated on attendance" ON public.attendance;
DROP POLICY IF EXISTS "View attendance policy" ON public.attendance;
DROP POLICY IF EXISTS "Create attendance policy" ON public.attendance;
DROP POLICY IF EXISTS "Update attendance policy" ON public.attendance;

-- SELECT attendance
CREATE POLICY "View attendance policy" ON public.attendance FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
    AND employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.department = (SELECT me.department FROM public.employees me WHERE me.user_id = auth.uid())
    )
  )
  OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- INSERT attendance (Clock-in)
CREATE POLICY "Create attendance policy" ON public.attendance FOR INSERT TO authenticated
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- UPDATE attendance (Clock-out/Correction)
CREATE POLICY "Update attendance policy" ON public.attendance FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
    AND employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.department = (SELECT me.department FROM public.employees me WHERE me.user_id = auth.uid())
    )
  )
  OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);


-- 4. Clean and define EXPENSE_CLAIMS RLS Policies
DROP POLICY IF EXISTS "Employees can create expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can view own expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can manage own expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Allow all authenticated on expense_claims" ON public.expense_claims;
DROP POLICY IF EXISTS "View expense_claims policy" ON public.expense_claims;
DROP POLICY IF EXISTS "Create expense_claims policy" ON public.expense_claims;
DROP POLICY IF EXISTS "Update expense_claims policy" ON public.expense_claims;

-- SELECT expense_claims
CREATE POLICY "View expense_claims policy" ON public.expense_claims FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
    AND employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.department = (SELECT me.department FROM public.employees me WHERE me.user_id = auth.uid())
    )
  )
  OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- INSERT expense_claims
CREATE POLICY "Create expense_claims policy" ON public.expense_claims FOR INSERT TO authenticated
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- UPDATE expense_claims
CREATE POLICY "Update expense_claims policy" ON public.expense_claims FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
    AND employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.department = (SELECT me.department FROM public.employees me WHERE me.user_id = auth.uid())
    )
  )
  OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
