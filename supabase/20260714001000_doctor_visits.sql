-- ====================================================================
-- DOCTOR VISIT & FIELD LOCATION TRACKING MODULE
-- ====================================================================

-- 1. Create doctor_visits table
CREATE TABLE IF NOT EXISTS public.doctor_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    doctor_name TEXT NOT NULL,
    hospital_name TEXT NOT NULL,
    contact_number TEXT,
    visit_purpose TEXT NOT NULL,
    notes TEXT,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    check_in_latitude NUMERIC,
    check_in_longitude NUMERIC,
    check_in_accuracy NUMERIC,
    check_in_address TEXT,
    check_in_time TIMESTAMPTZ,
    
    check_out_latitude NUMERIC,
    check_out_longitude NUMERIC,
    check_out_accuracy NUMERIC,
    check_out_address TEXT,
    check_out_time TIMESTAMPTZ,
    
    visit_duration INTEGER, -- stored in minutes
    status TEXT NOT NULL DEFAULT 'Checked In', -- 'Checked In', 'Completed', 'Cancelled'
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doctor_visits_employee_id ON public.doctor_visits(employee_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_visit_date ON public.doctor_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_status ON public.doctor_visits(status);

-- 3. Row Level Security
ALTER TABLE public.doctor_visits ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own visits
DROP POLICY IF EXISTS "Employees can view own visits" ON public.doctor_visits;
CREATE POLICY "Employees can view own visits" 
ON public.doctor_visits FOR SELECT 
TO authenticated 
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Policy: Employees can insert their own visits
DROP POLICY IF EXISTS "Employees can insert own visits" ON public.doctor_visits;
CREATE POLICY "Employees can insert own visits" 
ON public.doctor_visits FOR INSERT 
TO authenticated 
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Policy: Employees can update their own visits
DROP POLICY IF EXISTS "Employees can update own visits" ON public.doctor_visits;
CREATE POLICY "Employees can update own visits" 
ON public.doctor_visits FOR UPDATE 
TO authenticated 
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Policy: HR/Admin can view all visits
DROP POLICY IF EXISTS "HR and Admin can view all visits" ON public.doctor_visits;
CREATE POLICY "HR and Admin can view all visits" 
ON public.doctor_visits FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

-- Policy: HR/Admin can update all visits
DROP POLICY IF EXISTS "HR and Admin can update all visits" ON public.doctor_visits;
CREATE POLICY "HR and Admin can update all visits" 
ON public.doctor_visits FOR UPDATE
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

-- 4. Audit Log for Reports (if an audit table doesn't exist, we'll create a basic one for exports)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs" 
ON public.audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admin can view all audit logs" 
ON public.audit_logs FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
