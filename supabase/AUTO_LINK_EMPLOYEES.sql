-- ================================================================
-- AUTO-LINK EMPLOYEES ON AUTH USER CREATION
-- Run this in your Supabase SQL Editor
-- ================================================================

-- Update the public.handle_new_user() trigger function to automatically link new auth users to employees
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;

  -- Insert employee role
  INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;

  -- Auto-link newly created user to matching employee record (by email)
  UPDATE public.employees
  SET user_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email) AND user_id IS NULL;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Run a one-time immediate sync for existing unlinked employees
UPDATE public.employees e
SET user_id = au.id
FROM auth.users au
WHERE LOWER(e.email) = LOWER(au.email)
  AND (e.user_id IS NULL OR e.user_id != au.id);
