-- ================================================================
-- FIX: MISSING PROFILE INSERT POLICY & AUTH HANGS
-- ================================================================

-- 1. Allow users to insert their own profile 
-- This is needed for the frontend syncUserRecords function
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles 
  FOR INSERT TO authenticated 
  WITH CHECK (id = auth.uid());

-- 2. Ensure profiles are visible to all authenticated (for directory etc)
DROP POLICY IF EXISTS "Profiles are visible to authenticated users" ON public.profiles;
CREATE POLICY "Profiles are visible to authenticated users" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (true);

-- 3. Ensure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE TO authenticated 
  USING (id = auth.uid());

-- 4. Ensure user_roles is readable (for role-based routing/UI)
DROP POLICY IF EXISTS "Allow all authenticated on user_roles" ON public.user_roles;
CREATE POLICY "Allow all authenticated on user_roles" ON public.user_roles 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 5. Final check on employees linking
UPDATE public.employees e
SET user_id = au.id
FROM auth.users au
WHERE LOWER(e.email) = LOWER(au.email)
  AND (e.user_id IS NULL OR e.user_id != au.id);
