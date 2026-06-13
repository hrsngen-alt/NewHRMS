-- Add total_experience to employees
ALTER TABLE employees 
ADD COLUMN total_experience numeric(4,1) DEFAULT NULL;

-- Create employee_assets table
CREATE TABLE employee_assets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    asset_name text NOT NULL,
    asset_id text,
    asset_type text,
    assigned_date date DEFAULT CURRENT_DATE,
    status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'returned', 'lost', 'damaged')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for employee_assets
ALTER TABLE employee_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
ON employee_assets FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert for admins" 
ON employee_assets FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Enable update for admins" 
ON employee_assets FOR UPDATE
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Enable delete for admins" 
ON employee_assets FOR DELETE
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('admin', 'manager')
  )
);
