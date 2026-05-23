-- ================================================================
-- AUTO-LINK EMPLOYEES ON AUTH USER CREATION & RPC FOR INVITES
-- Run this in your Supabase SQL Editor
-- ================================================================

-- 1. Update the public.handle_new_user() trigger function to automatically link new auth users to employees
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

-- 2. Create the create_invited_user RPC to securely pre-create the user in auth.users
CREATE OR REPLACE FUNCTION public.create_invited_user(p_email TEXT, p_full_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_catalog
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(p_email);
  
  -- If user doesn't exist, create them
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_encrypted_password := crypt(substring(md5(random()::text) from 1 for 16), gen_salt('bf'));
    
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      phone_change
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      LOWER(p_email),
      v_encrypted_password,
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name),
      now(),
      now(),
      '',
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', LOWER(p_email)),
      'email',
      LOWER(p_email),
      now(),
      now()
    );
  END IF;
  
  RETURN v_user_id;
END;
$$;

-- 3. Run a one-time immediate sync for existing unlinked employees
UPDATE public.employees e
SET user_id = au.id
FROM auth.users au
WHERE LOWER(e.email) = LOWER(au.email)
  AND (e.user_id IS NULL OR e.user_id != au.id);
