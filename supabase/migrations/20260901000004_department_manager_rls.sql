-- Helper function to check if the user is a Department Manager
CREATE OR REPLACE FUNCTION public.is_department_manager(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.employee_custom_roles ecr
    JOIN public.custom_roles cr ON ecr.role_id = cr.id
    JOIN public.employees e ON ecr.employee_id = e.id
    WHERE e.user_id = _user_id 
      AND cr.code = 'department_manager'
  )
$$;

-- Helper function to check if the user is in the exact same department as the target employee
CREATE OR REPLACE FUNCTION public.is_same_department(_user_id UUID, _target_emp_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.employees u
    JOIN public.employees t ON u.department = t.department
    WHERE u.user_id = _user_id 
      AND t.id = _target_emp_id
      AND u.department IS NOT NULL
      AND u.department != ''
  )
$$;

-- Enable RLS just in case for new tables
ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resignations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

-- 1. Leaves Table
CREATE POLICY "Department Managers can view leaves for their department" ON public.leaves
  FOR SELECT TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

CREATE POLICY "Department Managers can update leaves for their department" ON public.leaves
  FOR UPDATE TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  )
  WITH CHECK (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

-- 2. Attendance Table
CREATE POLICY "Department Managers can view attendance for their department" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

CREATE POLICY "Department Managers can update attendance for their department" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  )
  WITH CHECK (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

-- 3. Resignations Table
CREATE POLICY "Department Managers can view resignations for their department" ON public.resignations
  FOR SELECT TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

CREATE POLICY "Department Managers can update resignations for their department" ON public.resignations
  FOR UPDATE TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  )
  WITH CHECK (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

-- 4. Performance Reviews Table
CREATE POLICY "Department Managers can view performance for their department" ON public.performance_reviews
  FOR SELECT TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

CREATE POLICY "Department Managers can update performance for their department" ON public.performance_reviews
  FOR UPDATE TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  )
  WITH CHECK (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

-- 5. Expense Claims Table
CREATE POLICY "Department Managers can view expenses for their department" ON public.expense_claims
  FOR SELECT TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );

CREATE POLICY "Department Managers can update expenses for their department" ON public.expense_claims
  FOR UPDATE TO authenticated
  USING (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  )
  WITH CHECK (
    public.is_department_manager(auth.uid()) 
    AND public.is_same_department(auth.uid(), employee_id)
  );
