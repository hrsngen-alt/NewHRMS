-- Update handle_new_user to stop auto-creating employees in the database.
-- It should ONLY try to link the auth.user to an EXISTING employee record.
-- If no employee record exists (by email), it does nothing, leaving them unlinked.
-- Our frontend will see they have no employee record and block their login.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  row_count INT;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 'employee')
    ON CONFLICT (id) DO NOTHING;

  -- Insert employee role
  INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;

  -- Auto-link newly created user to matching employee record (by email)
  UPDATE public.employees
  SET user_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email);

  -- We intentionally DO NOT create a new employee record if one isn't found.
  -- This forces HR to pre-register employees before they can log in.

  RETURN NEW;
END;
$$;
