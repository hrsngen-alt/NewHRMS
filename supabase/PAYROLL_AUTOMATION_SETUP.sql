-- ================================================================
-- ATTENDANCE-BASED PAYROLL AUTOMATION DATABASE SETUP
-- Run this script in your Supabase SQL Editor
-- ================================================================

-- 1. ADD COLUMNS TO public.attendance
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_minutes INT DEFAULT 0;

-- 2. ADD COLUMNS TO public.payslips
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_pay NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentives NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deductions NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS half_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_marks INT DEFAULT 0;

-- 3. CREATE public.loans TABLE
CREATE TABLE IF NOT EXISTS public.loans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_emi        NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CREATE public.payroll_addons TABLE
CREATE TABLE IF NOT EXISTS public.payroll_addons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month     INT NOT NULL,
  period_year      INT NOT NULL,
  incentive        NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_rate    NUMERIC(12,2) NOT NULL DEFAULT 0, -- override hourly overtime rate (0 = auto-calculate)
  other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, period_month, period_year)
);

-- 5. ADD COLUMNS TO public.payroll_runs
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_logs JSONB DEFAULT '[]'::jsonb;

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_addons ENABLE ROW LEVEL SECURITY;

-- 7. CREATE RLS POLICIES FOR NEW TABLES
DROP POLICY IF EXISTS "Allow all authenticated on loans" ON public.loans;
CREATE POLICY "Allow all authenticated on loans" ON public.loans FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated on payroll_addons" ON public.payroll_addons;
CREATE POLICY "Allow all authenticated on payroll_addons" ON public.payroll_addons FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
SELECT 'SUCCESS! Payroll Automation schema is configured.' as status;
