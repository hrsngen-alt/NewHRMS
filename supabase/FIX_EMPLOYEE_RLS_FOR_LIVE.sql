-- ================================================================
-- FIX EMPLOYEE RLS FOR LIVE DATABASE: ALLOW SELF-LINKING USER_ID
-- ================================================================

-- 1. Drop old policies if they restrict update/insert
DROP POLICY IF EXISTS "Employees can update own record" ON public.employees;
DROP POLICY IF EXISTS "Employees can insert own record" ON public.employees;

-- 2. Allow employees to link their Auth UID (update 'user_id' or edit details)
-- if their email matches the authenticated user's email, or if their user_id is already matched.
CREATE POLICY "Employees can update own record" ON public.employees 
  FOR UPDATE TO authenticated 
  USING (
    email = auth.jwt()->>'email' OR 
    user_id = auth.uid()
  )
  WITH CHECK (
    email = auth.jwt()->>'email' OR 
    user_id = auth.uid()
  );

-- 3. Allow employees to self-register their profile if it doesn't exist yet
CREATE POLICY "Employees can insert own record" ON public.employees 
  FOR INSERT TO authenticated 
  WITH CHECK (
    email = auth.jwt()->>'email' AND 
    user_id = auth.uid()
  );
