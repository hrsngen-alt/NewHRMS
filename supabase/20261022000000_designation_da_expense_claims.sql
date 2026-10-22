-- Designation-Wise DA & 20-Day Expense Claim System Migration
-- Created to support Master Prompt - Designation-Wise DA & Expense Claim Automation

-- 1. Employee DA Master Table
CREATE TABLE IF NOT EXISTS public.employee_da_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sr_no INT,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    employee_name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Sales & Marketing',
    designation TEXT NOT NULL,
    location TEXT,
    fixed_daily_da NUMERIC(10,2), -- NULL means DA Rate Missing
    da_rule TEXT NOT NULL DEFAULT 'Doctor Visit', -- 'Doctor Visit' or 'Check-In/Check-Out'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Expense Claim Batches Table (20-Day Batches)
CREATE TABLE IF NOT EXISTS public.expense_claim_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number TEXT NOT NULL UNIQUE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    designation TEXT NOT NULL,
    department TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_eligible_da NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_other_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_claim_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    missing_bills_count INT NOT NULL DEFAULT 0,
    exceptions_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending_manager', -- 'draft', 'pending_manager', 'manager_approved', 'approved', 'rejected'
    manager_approval JSONB, -- { approvedBy, approvedAt, notes }
    hr_approval JSONB, -- { approvedBy, approvedAt, notes }
    rows_data JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of 20 daily claim rows
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_da_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_claim_batches ENABLE ROW LEVEL SECURITY;

-- Policies for employee_da_master
CREATE POLICY "Authenticated users can view DA master"
    ON public.employee_da_master FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers can manage DA master"
    ON public.employee_da_master FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
        )
    );

-- Policies for expense_claim_batches
CREATE POLICY "Employees can view own batches or authorized staff"
    ON public.expense_claim_batches FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.employees e WHERE e.id = expense_claim_batches.employee_id AND e.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager'))
    );

CREATE POLICY "Employees can insert own batches"
    ON public.expense_claim_batches FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.employees e WHERE e.id = expense_claim_batches.employee_id AND e.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    );

CREATE POLICY "Authorized staff can update batches"
    ON public.expense_claim_batches FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.employees e WHERE e.id = expense_claim_batches.employee_id AND e.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager'))
    );
