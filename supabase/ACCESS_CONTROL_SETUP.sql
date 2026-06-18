-- ================================================================
-- ACCESS CONTROL & PERMISSION MANAGEMENT DATABASE SETUP
-- Run this script in your Supabase SQL Editor
-- ================================================================

-- 1. CUSTOM ROLES TABLE
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  code        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ROLE PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id              UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  module               TEXT NOT NULL,
  action               TEXT NOT NULL,
  scope                TEXT NOT NULL DEFAULT 'company', -- 'self', 'team', 'department', 'branch', 'company', 'custom'
  custom_scope_details JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, module, action)
);

-- 3. EMPLOYEE CUSTOM ROLES TABLE
CREATE TABLE IF NOT EXISTS public.employee_custom_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, role_id)
);

-- 4. USER PERMISSION OVERRIDES TABLE
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  module      TEXT NOT NULL,
  action      TEXT NOT NULL,
  allow       BOOLEAN NOT NULL DEFAULT true,
  scope       TEXT NOT NULL DEFAULT 'company',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, module, action)
);

-- 5. TEMPORARY ACCESS DELEGATION TABLE
CREATE TABLE IF NOT EXISTS public.temporary_delegations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  to_employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id          UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'expired'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. APPROVAL WORKFLOWS TABLE
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  workflow_type TEXT NOT NULL, -- 'leave', 'attendance_regularization', 'expense', 'recruitment', 'salary_revision'
  department    TEXT DEFAULT 'all',
  steps         JSONB NOT NULL, -- e.g., [{"step": 1, "role_id": "uuid", "name": "Manager Review"}]
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. SECURITY AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_name TEXT,
  action        TEXT NOT NULL,
  module        TEXT NOT NULL,
  details       TEXT,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- 9. CREATE RLS POLICIES (Allow all authenticated users full access in this internal HRMS)
DROP POLICY IF EXISTS "Allow all authenticated on custom_roles" ON public.custom_roles;
CREATE POLICY "Allow all authenticated on custom_roles" ON public.custom_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated on role_permissions" ON public.role_permissions;
CREATE POLICY "Allow all authenticated on role_permissions" ON public.role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated on employee_custom_roles" ON public.employee_custom_roles;
CREATE POLICY "Allow all authenticated on employee_custom_roles" ON public.employee_custom_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated on user_permission_overrides" ON public.user_permission_overrides;
CREATE POLICY "Allow all authenticated on user_permission_overrides" ON public.user_permission_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated on temporary_delegations" ON public.temporary_delegations;
CREATE POLICY "Allow all authenticated on temporary_delegations" ON public.temporary_delegations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated on approval_workflows" ON public.approval_workflows;
CREATE POLICY "Allow all authenticated on approval_workflows" ON public.approval_workflows FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated on security_audit_logs" ON public.security_audit_logs;
CREATE POLICY "Allow all authenticated on security_audit_logs" ON public.security_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. SEED DEFAULT SYSTEM ROLES
INSERT INTO public.custom_roles (name, code, description, is_system) VALUES
  ('Super Admin', 'super_admin', 'Full system access to all modules, settings, and workflows.', true),
  ('HR Admin', 'hr_admin', 'Full HR access including directory, leave management, payroll, and settings.', true),
  ('HR Executive', 'hr_executive', 'Manage employees directory, attendance, leaves, and recruitment.', true),
  ('Recruiter', 'recruiter', 'Access recruitment module to publish job posts and screen candidates.', true),
  ('Payroll Manager', 'payroll_manager', 'Access and execute monthly payroll runs and generate salary structures.', true),
  ('Department Manager', 'department_manager', 'Manage leaves, attendance, and performance for employees within their department.', true),
  ('Team Lead', 'team_lead', 'Track attendance, leaves, and project performance for direct team members.', true),
  ('Employee', 'employee', 'View dashboard, check in/out, submit leave requests, view profile, and download salary slips.', true),
  ('Manager', 'manager', 'General manager role with team review, leave approvals, and report views.', true),
  ('Software Engineer', 'software_engineer', 'Technical team member, standard employee privileges.', true),
  ('QA Engineer', 'qa_engineer', 'Quality assurance team member, standard employee privileges.', true),
  ('Designer', 'designer', 'Creative team member, standard employee privileges.', true)
ON CONFLICT (code) DO NOTHING;

-- 11. SEED DEFAULT SYSTEM PERMISSIONS (Link permissions to the standard roles)
-- Helper to associate permissions to Super Admin & HR Admin
DO $$
DECLARE
  super_admin_id UUID;
  hr_admin_id UUID;
  recruiter_id UUID;
  payroll_manager_id UUID;
  employee_id UUID;
  manager_id UUID;
  software_engineer_id UUID;
  qa_engineer_id UUID;
  designer_id UUID;
  
  modules TEXT[] := ARRAY['Dashboard', 'Employee Directory', 'Attendance', 'Leave', 'Payroll', 'Recruitment', 'Reports', 'Holidays', 'Announcements', 'Assets', 'Performance Management', 'Settings'];
  m TEXT;
  actions TEXT[] := ARRAY['view', 'create', 'edit', 'delete', 'approve', 'export', 'import', 'manage'];
  a TEXT;
BEGIN
  SELECT id INTO super_admin_id FROM public.custom_roles WHERE code = 'super_admin';
  SELECT id INTO hr_admin_id FROM public.custom_roles WHERE code = 'hr_admin';
  SELECT id INTO recruiter_id FROM public.custom_roles WHERE code = 'recruiter';
  SELECT id INTO payroll_manager_id FROM public.custom_roles WHERE code = 'payroll_manager';
  SELECT id INTO employee_id FROM public.custom_roles WHERE code = 'employee';
  SELECT id INTO manager_id FROM public.custom_roles WHERE code = 'manager';
  SELECT id INTO software_engineer_id FROM public.custom_roles WHERE code = 'software_engineer';
  SELECT id INTO qa_engineer_id FROM public.custom_roles WHERE code = 'qa_engineer';
  SELECT id INTO designer_id FROM public.custom_roles WHERE code = 'designer';

  IF super_admin_id IS NOT NULL THEN
    -- Super Admin gets everything
    FOREACH m IN ARRAY modules LOOP
      FOREACH a IN ARRAY actions LOOP
        INSERT INTO public.role_permissions (role_id, module, action, scope)
        VALUES (super_admin_id, m, a, 'company')
        ON CONFLICT (role_id, module, action) DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  IF hr_admin_id IS NOT NULL THEN
    -- HR Admin gets everything
    FOREACH m IN ARRAY modules LOOP
      FOREACH a IN ARRAY actions LOOP
        INSERT INTO public.role_permissions (role_id, module, action, scope)
        VALUES (hr_admin_id, m, a, 'company')
        ON CONFLICT (role_id, module, action) DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  -- Recruiter permissions
  IF recruiter_id IS NOT NULL THEN
    -- View recruitment and dashboard
    INSERT INTO public.role_permissions (role_id, module, action, scope) VALUES
      (recruiter_id, 'Dashboard', 'view', 'company'),
      (recruiter_id, 'Recruitment', 'view', 'company'),
      (recruiter_id, 'Recruitment', 'create', 'company'),
      (recruiter_id, 'Recruitment', 'edit', 'company'),
      (recruiter_id, 'Recruitment', 'approve', 'company'),
      (recruiter_id, 'Employee Directory', 'view', 'company')
    ON CONFLICT (role_id, module, action) DO NOTHING;
  END IF;

  -- Payroll Manager permissions
  IF payroll_manager_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, module, action, scope) VALUES
      (payroll_manager_id, 'Dashboard', 'view', 'company'),
      (payroll_manager_id, 'Payroll', 'view', 'company'),
      (payroll_manager_id, 'Payroll', 'create', 'company'),
      (payroll_manager_id, 'Payroll', 'edit', 'company'),
      (payroll_manager_id, 'Payroll', 'approve', 'company'),
      (payroll_manager_id, 'Payroll', 'export', 'company'),
      (payroll_manager_id, 'Employee Directory', 'view', 'company')
    ON CONFLICT (role_id, module, action) DO NOTHING;
  END IF;

  -- Employee permissions (default self-service)
  IF employee_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, module, action, scope) VALUES
      (employee_id, 'Dashboard', 'view', 'self'),
      (employee_id, 'Attendance', 'view', 'self'),
      (employee_id, 'Attendance', 'create', 'self'),
      (employee_id, 'Leave', 'view', 'self'),
      (employee_id, 'Leave', 'create', 'self'),
      (employee_id, 'Performance Management', 'view', 'self'),
      (employee_id, 'Holidays', 'view', 'company'),
      (employee_id, 'Announcements', 'view', 'company'),
      (employee_id, 'Employee Directory', 'view', 'company')
    ON CONFLICT (role_id, module, action) DO NOTHING;
  END IF;

  -- Software Engineer permissions (default self-service)
  IF software_engineer_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, module, action, scope) VALUES
      (software_engineer_id, 'Dashboard', 'view', 'self'),
      (software_engineer_id, 'Attendance', 'view', 'self'),
      (software_engineer_id, 'Attendance', 'create', 'self'),
      (software_engineer_id, 'Leave', 'view', 'self'),
      (software_engineer_id, 'Leave', 'create', 'self'),
      (software_engineer_id, 'Performance Management', 'view', 'self'),
      (software_engineer_id, 'Holidays', 'view', 'company'),
      (software_engineer_id, 'Announcements', 'view', 'company'),
      (software_engineer_id, 'Employee Directory', 'view', 'company')
    ON CONFLICT (role_id, module, action) DO NOTHING;
  END IF;

  -- QA Engineer permissions (default self-service)
  IF qa_engineer_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, module, action, scope) VALUES
      (qa_engineer_id, 'Dashboard', 'view', 'self'),
      (qa_engineer_id, 'Attendance', 'view', 'self'),
      (qa_engineer_id, 'Attendance', 'create', 'self'),
      (qa_engineer_id, 'Leave', 'view', 'self'),
      (qa_engineer_id, 'Leave', 'create', 'self'),
      (qa_engineer_id, 'Performance Management', 'view', 'self'),
      (qa_engineer_id, 'Holidays', 'view', 'company'),
      (qa_engineer_id, 'Announcements', 'view', 'company'),
      (qa_engineer_id, 'Employee Directory', 'view', 'company')
    ON CONFLICT (role_id, module, action) DO NOTHING;
  END IF;

  -- Designer permissions (default self-service)
  IF designer_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, module, action, scope) VALUES
      (designer_id, 'Dashboard', 'view', 'self'),
      (designer_id, 'Attendance', 'view', 'self'),
      (designer_id, 'Attendance', 'create', 'self'),
      (designer_id, 'Leave', 'view', 'self'),
      (designer_id, 'Leave', 'create', 'self'),
      (designer_id, 'Performance Management', 'view', 'self'),
      (designer_id, 'Holidays', 'view', 'company'),
      (designer_id, 'Announcements', 'view', 'company'),
      (designer_id, 'Employee Directory', 'view', 'company')
    ON CONFLICT (role_id, module, action) DO NOTHING;
  END IF;

  -- Manager permissions (default self-service + team review)
  IF manager_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, module, action, scope) VALUES
      (manager_id, 'Dashboard', 'view', 'self'),
      (manager_id, 'Attendance', 'view', 'team'),
      (manager_id, 'Attendance', 'create', 'self'),
      (manager_id, 'Leave', 'view', 'team'),
      (manager_id, 'Leave', 'create', 'self'),
      (manager_id, 'Performance Management', 'view', 'team'),
      (manager_id, 'Holidays', 'view', 'company'),
      (manager_id, 'Announcements', 'view', 'company'),
      (manager_id, 'Employee Directory', 'view', 'company'),
      (manager_id, 'Reports', 'view', 'team')
    ON CONFLICT (role_id, module, action) DO NOTHING;
  END IF;
END $$;
