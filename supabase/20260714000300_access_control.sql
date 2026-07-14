-- Add login_enabled to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN NOT NULL DEFAULT true;

-- Create employee_access_logs table
CREATE TABLE IF NOT EXISTS employee_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('Enabled', 'Disabled')),
  reason TEXT,
  notes TEXT,
  performed_by UUID NOT NULL REFERENCES employees(id),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE employee_access_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view access logs" 
  ON employee_access_logs FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert access logs" 
  ON employee_access_logs FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
