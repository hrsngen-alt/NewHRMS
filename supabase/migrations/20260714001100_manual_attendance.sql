-- ====================================================================
-- MANUAL ATTENDANCE REQUEST & APPROVAL SYSTEM
-- ====================================================================

-- 1. Create manual_attendance_requests table
CREATE TABLE IF NOT EXISTS public.manual_attendance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    request_date DATE NOT NULL,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_manual_attendance_employee_id ON public.manual_attendance_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_manual_attendance_status ON public.manual_attendance_requests(status);
CREATE INDEX IF NOT EXISTS idx_manual_attendance_date ON public.manual_attendance_requests(request_date);

-- 3. Row Level Security
ALTER TABLE public.manual_attendance_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own requests
DROP POLICY IF EXISTS "Employees can view own manual requests" ON public.manual_attendance_requests;
CREATE POLICY "Employees can view own manual requests" 
ON public.manual_attendance_requests FOR SELECT 
TO authenticated 
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Employees can insert their own requests (checking limit is done via frontend + DB function)
DROP POLICY IF EXISTS "Employees can insert own manual requests" ON public.manual_attendance_requests;
CREATE POLICY "Employees can insert own manual requests" 
ON public.manual_attendance_requests FOR INSERT 
TO authenticated 
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Managers, HR, and Admins can view all requests
DROP POLICY IF EXISTS "Managers and Admins can view all manual requests" ON public.manual_attendance_requests;
CREATE POLICY "Managers and Admins can view all manual requests" 
ON public.manual_attendance_requests FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

-- Managers, HR, and Admins can update requests
DROP POLICY IF EXISTS "Managers and Admins can update manual requests" ON public.manual_attendance_requests;
CREATE POLICY "Managers and Admins can update manual requests" 
ON public.manual_attendance_requests FOR UPDATE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

-- 4. Database function to safely insert the approved manual attendance into the real attendance table
CREATE OR REPLACE FUNCTION public.approve_manual_attendance(
  request_id UUID,
  approver_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req RECORD;
  emp RECORD;
  existing_att_id UUID;
  worked_hours NUMERIC(5,2);
BEGIN
  -- 1. Fetch request and check if pending
  SELECT * INTO req FROM public.manual_attendance_requests WHERE id = request_id AND status = 'Pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- 2. Fetch employee details
  SELECT * INTO emp FROM public.employees WHERE id = req.employee_id;

  -- 3. Update Request Status
  UPDATE public.manual_attendance_requests 
  SET status = 'Approved', approved_by = approver_id, updated_at = now() 
  WHERE id = request_id;

  -- 4. Calculate hours if both times exist
  IF req.check_in_time IS NOT NULL AND req.check_out_time IS NOT NULL THEN
    worked_hours := ROUND(EXTRACT(EPOCH FROM (req.check_out_time - req.check_in_time)) / 3600.0, 2);
  ELSE
    worked_hours := 0;
  END IF;

  -- 5. Check if an attendance record already exists for this employee on this date
  SELECT id INTO existing_att_id 
  FROM public.attendance 
  WHERE employee_id = req.employee_id AND date = req.request_date 
  LIMIT 1;

  IF FOUND THEN
    -- Update existing record
    UPDATE public.attendance 
    SET 
      check_in = COALESCE(req.check_in_time, check_in),
      check_out = COALESCE(req.check_out_time, check_out),
      hours_worked = CASE WHEN req.check_out_time IS NOT NULL THEN worked_hours ELSE hours_worked END,
      check_out_type = 'Manual (Approved)'
    WHERE id = existing_att_id;
  ELSE
    -- Insert new record
    INSERT INTO public.attendance (
      employee_id, date, check_in, check_out, hours_worked, 
      employee_name, department, check_out_type
    ) VALUES (
      req.employee_id, req.request_date, req.check_in_time, req.check_out_time, worked_hours,
      emp.full_name, emp.department, 'Manual (Approved)'
    );
  END IF;

END;
$$;
