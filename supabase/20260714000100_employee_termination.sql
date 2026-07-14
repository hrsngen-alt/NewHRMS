-- ====================================================================
-- EMPLOYEE TERMINATION SYSTEM MIGRATION
-- Adds tracking of company-initiated terminations, asset recovery checklist,
-- and audit logging records.
-- ====================================================================

-- 1. Create terminations table
CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    termination_date DATE NOT NULL,
    last_working_date DATE NOT NULL,
    termination_type TEXT NOT NULL,
    termination_reason TEXT NOT NULL,
    termination_letter_url TEXT,
    approved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    notice_period INTEGER NOT NULL DEFAULT 0,
    exit_interview_required BOOLEAN NOT NULL DEFAULT FALSE,
    company_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
    recovery_status TEXT NOT NULL DEFAULT 'Pending',
    status TEXT NOT NULL DEFAULT 'Terminated',
    audit_created_by UUID,
    audit_created_at TIMESTAMPTZ DEFAULT now(),
    audit_ip_address TEXT,
    audit_edited_by UUID,
    audit_cancelled_by UUID,
    audit_cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS on terminations table
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- 3. Define RLS Policies for select
DROP POLICY IF EXISTS "Allow read access to terminations for authenticated users" ON public.terminations;
CREATE POLICY "Allow read access to terminations for authenticated users"
ON public.terminations FOR SELECT TO authenticated USING (true);

-- 4. Define RLS Policies for manage actions (Insert/Update/Delete) for Admins
DROP POLICY IF EXISTS "Allow manage access to terminations for administrators" ON public.terminations;
CREATE POLICY "Allow manage access to terminations for administrators"
ON public.terminations FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.employee_custom_roles ecr 
    JOIN public.custom_roles cr ON cr.id = ecr.role_id
    JOIN public.employees e ON e.id = ecr.employee_id
    WHERE e.user_id = auth.uid() AND cr.code IN ('super_admin', 'hr_admin', 'hr_manager')
  )
);
