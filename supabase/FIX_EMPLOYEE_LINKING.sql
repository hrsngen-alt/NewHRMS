-- ================================================================
-- PASTE THIS ENTIRE BLOCK INTO SUPABASE SQL EDITOR AND CLICK RUN
-- ================================================================

-- Step 1: Auto-link employees to auth users by matching email
UPDATE employees e
SET user_id = au.id
FROM auth.users au
WHERE LOWER(e.email) = LOWER(au.email)
  AND (e.user_id IS NULL OR e.user_id != au.id);

-- Step 2: Ensure every auth user has at least an 'employee' role
INSERT INTO user_roles (user_id, role)
SELECT au.id, 'employee'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = au.id
)
ON CONFLICT DO NOTHING;

-- Step 3: Ensure profiles exist for all auth users
INSERT INTO profiles (id, full_name, created_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  now()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Fix attendance RLS
DROP POLICY IF EXISTS "Employees can manage own attendance" ON public.attendance;
CREATE POLICY "Employees can manage own attendance" ON public.attendance 
  FOR ALL TO authenticated 
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  )
  WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  );

-- Step 5: Fix leaves RLS
DROP POLICY IF EXISTS "Employees can manage own leaves" ON public.leaves;
CREATE POLICY "Employees can manage own leaves" ON public.leaves 
  FOR ALL TO authenticated 
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  )
  WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  );

-- Step 6: Fix expense_claims RLS
DROP POLICY IF EXISTS "Employees can create expenses" ON public.expense_claims;
DROP POLICY IF EXISTS "Employees can view own expenses" ON public.expense_claims;
CREATE POLICY "Employees can manage own expenses" ON public.expense_claims 
  FOR ALL TO authenticated 
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  );

-- Step 7: Fix payslips RLS
DROP POLICY IF EXISTS "Employees can view own payslips" ON public.payslips;
CREATE POLICY "Employees can view own payslips" ON public.payslips 
  FOR SELECT TO authenticated 
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Step 8: Fix performance_reviews RLS
DROP POLICY IF EXISTS "Employees can view own reviews" ON public.performance_reviews;
CREATE POLICY "Employees can view own reviews" ON public.performance_reviews 
  FOR SELECT TO authenticated 
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Verify: Show linked employees
SELECT 
  e.full_name,
  e.email AS emp_email,
  e.user_id,
  au.email AS auth_email
FROM employees e
LEFT JOIN auth.users au ON au.id = e.user_id
ORDER BY e.full_name;
