-- ================================================================
-- FRESH SUPABASE PROJECT SETUP SCRIPT
-- Run this ONCE in your BRAND NEW Supabase project's SQL Editor
-- ================================================================

-- 1. ENUMS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'employee');
  END IF;
END $$;

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. USER_ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 4. EMPLOYEES
CREATE TABLE IF NOT EXISTS public.employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code     TEXT NOT NULL UNIQUE,
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  phone             TEXT,
  department        TEXT,
  designation       TEXT,
  joining_date      DATE,
  pan_number        TEXT UNIQUE,
  aadhaar_number    TEXT UNIQUE,
  uan_number        TEXT UNIQUE,
  bank_name         TEXT,
  bank_account      TEXT,
  bank_ifsc         TEXT,
  reporting_manager TEXT,
  basic_salary      NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra               NUMERIC(12,2) NOT NULL DEFAULT 0,
  conveyance        NUMERIC(12,2) NOT NULL DEFAULT 0,
  medical           NUMERIC(12,2) NOT NULL DEFAULT 0,
  special_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  check_in     TIMESTAMPTZ,
  check_out    TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'present',
  hours_worked NUMERIC(5,2) DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- 6. LEAVES
CREATE TABLE IF NOT EXISTS public.leaves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  days        NUMERIC(4,1) NOT NULL DEFAULT 1,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PAYROLL_RUNS
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month INT NOT NULL,
  period_year  INT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',
  total_net    NUMERIC(14,2) DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_month, period_year)
);

-- 8. PAYSLIPS
CREATE TABLE IF NOT EXISTS public.payslips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id    UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES public.employees(id)    ON DELETE CASCADE,
  working_days      INT NOT NULL DEFAULT 30,
  paid_days         NUMERIC(4,1) NOT NULL DEFAULT 30,
  basic             NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra               NUMERIC(12,2) NOT NULL DEFAULT 0,
  conveyance        NUMERIC(12,2) NOT NULL DEFAULT 0,
  medical           NUMERIC(12,2) NOT NULL DEFAULT 0,
  special_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus             NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf                NUMERIC(12,2) NOT NULL DEFAULT 0,
  esic              NUMERIC(12,2) NOT NULL DEFAULT 0,
  pt                NUMERIC(12,2) NOT NULL DEFAULT 0,
  tds               NUMERIC(12,2) NOT NULL DEFAULT 0,
  leave_deduction   NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions  NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay           NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_run_id, employee_id)
);

-- 9. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- 10. CREATE SAFE, CLEAN POLICIES
DROP POLICY IF EXISTS "Allow all authenticated on profiles" ON public.profiles;
CREATE POLICY "Allow all authenticated on profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all authenticated on user_roles" ON public.user_roles;
CREATE POLICY "Allow all authenticated on user_roles" ON public.user_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all authenticated on employees" ON public.employees;
CREATE POLICY "Allow all authenticated on employees" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all authenticated on attendance" ON public.attendance;
CREATE POLICY "Allow all authenticated on attendance" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all authenticated on leaves" ON public.leaves;
CREATE POLICY "Allow all authenticated on leaves" ON public.leaves FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all authenticated on payroll_runs" ON public.payroll_runs;
CREATE POLICY "Allow all authenticated on payroll_runs" ON public.payroll_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all authenticated on payslips" ON public.payslips;
CREATE POLICY "Allow all authenticated on payslips" ON public.payslips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 12. NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. EMPLOYEE CODE TRIGGER
CREATE SEQUENCE IF NOT EXISTS public.employee_code_seq START 1001;
CREATE OR REPLACE FUNCTION public.set_employee_code() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    NEW.employee_code := 'EMP' || nextval('public.employee_code_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_code ON public.employees;
CREATE TRIGGER trg_employee_code BEFORE INSERT ON public.employees 
  FOR EACH ROW EXECUTE FUNCTION public.set_employee_code();

-- 14. ADMIN SEED
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@pulsehr.com';
  
  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      admin_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'admin@pulsehr.com',
      crypt('Admin@123', gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "HR Admin"}'::jsonb, now(), now()
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
      admin_id, admin_id, admin_id::text, 
      jsonb_build_object('sub', admin_id, 'email', 'admin@pulsehr.com'), 
      'email', now(), now()
    );
  ELSE
    UPDATE auth.users
    SET 
      encrypted_password   = crypt('Admin@123', gen_salt('bf')),
      email_confirmed_at   = COALESCE(email_confirmed_at, now()),
      updated_at           = now(),
      aud                  = 'authenticated',
      role                 = 'authenticated',
      raw_app_meta_data    = '{"provider": "email", "providers": ["email"]}'::jsonb,
      raw_user_meta_data   = '{"full_name": "HR Admin"}'::jsonb
    WHERE id = admin_id;
  END IF;

  INSERT INTO public.profiles (id, full_name) VALUES (admin_id, 'HR Admin')
  ON CONFLICT (id) DO UPDATE SET full_name = 'HR Admin';

  DELETE FROM public.user_roles WHERE user_id = admin_id AND role = 'employee';
  INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

--------------------------------------------------------------------------------
-- 11. EMPLOYEE DOCUMENTS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated to manage documents" ON public.employee_documents;
CREATE POLICY "Allow authenticated to manage documents" ON public.employee_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
SELECT 'SUCCESS! Brand new Supabase database is ready to go.' as status;
