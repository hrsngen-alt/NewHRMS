-- =====================================================
-- Terminations Table Migration
-- =====================================================

CREATE TABLE IF NOT EXISTS public.terminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  -- Termination Details
  termination_date DATE NOT NULL,
  last_working_date DATE,
  termination_type TEXT NOT NULL DEFAULT 'Termination',
  termination_reason TEXT,
  termination_letter_url TEXT,

  -- Process
  notice_period INTEGER DEFAULT 0,
  exit_interview_required BOOLEAN DEFAULT FALSE,
  exit_interview_done BOOLEAN DEFAULT FALSE,
  company_assets TEXT,
  recovery_status TEXT DEFAULT 'Pending',

  -- Approval & Status
  status TEXT NOT NULL DEFAULT 'Terminated',
  approved_by UUID REFERENCES public.employees(id),

  -- Audit Fields
  audit_created_by UUID REFERENCES public.employees(id),
  audit_cancelled_by UUID REFERENCES public.employees(id),
  audit_cancelled_at TIMESTAMPTZ,
  audit_ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_terminations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_terminations_updated_at ON public.terminations;
CREATE TRIGGER trg_terminations_updated_at
BEFORE UPDATE ON public.terminations
FOR EACH ROW EXECUTE FUNCTION update_terminations_updated_at();

-- Enable Row Level Security
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage terminations" ON public.terminations;
DROP POLICY IF EXISTS "Employees can view own termination" ON public.terminations;

-- Admins can do everything
CREATE POLICY "Admins can manage terminations"
  ON public.terminations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- Employees can view their own termination record
CREATE POLICY "Employees can view own termination"
  ON public.terminations FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_terminations_employee_id ON public.terminations(employee_id);
CREATE INDEX IF NOT EXISTS idx_terminations_status ON public.terminations(status);
CREATE INDEX IF NOT EXISTS idx_terminations_created_at ON public.terminations(created_at DESC);
