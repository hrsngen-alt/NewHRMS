-- ==========================================
-- ROLE-BASED LEAVE MANAGEMENT MODULE
-- ==========================================

-- 1. Create leave_types
CREATE TABLE IF NOT EXISTS leave_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code varchar(20) UNIQUE NOT NULL,
    name varchar(100) NOT NULL,
    is_paid boolean DEFAULT true,
    default_annual_allowance numeric(5,1) DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default leave types (Safe to run multiple times by ignoring conflicts)
INSERT INTO leave_types (code, name, is_paid, default_annual_allowance) VALUES
('CL', 'Casual Leave', true, 12),
('SL', 'Sick Leave', true, 12),
('PL', 'Privilege Leave', true, 15),
('WFH', 'Work From Home', true, 0),
('LWP', 'Leave Without Pay', false, 0)
ON CONFLICT (code) DO NOTHING;

-- 2. Create leave_balances
CREATE TABLE IF NOT EXISTS leave_balances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_code varchar(20) REFERENCES leave_types(code) ON DELETE CASCADE,
    year integer NOT NULL,
    total_allocated numeric(5,1) DEFAULT 0,
    used numeric(5,1) DEFAULT 0,
    balance numeric(5,1) GENERATED ALWAYS AS (total_allocated - used) STORED,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, leave_type_code, year)
);

-- 3. Modify existing leaves table
ALTER TABLE leaves
ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS manager_status varchar(30) DEFAULT 'pending' CHECK (manager_status IN ('pending', 'approved', 'rejected', 'changes_requested')),
ADD COLUMN IF NOT EXISTS hr_status varchar(30) DEFAULT 'pending' CHECK (hr_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- (The existing `leave_type` in `leaves` will now conceptually map to `leave_types.code`)

-- 4. Create holidays table (Skip if it already exists, as we discovered it does!)
CREATE TABLE IF NOT EXISTS holidays (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    is_mandatory boolean DEFAULT true,
    type varchar(50) DEFAULT 'public',
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create leave_audit_logs
CREATE TABLE IF NOT EXISTS leave_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    leave_id uuid REFERENCES leaves(id) ON DELETE CASCADE,
    action_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type varchar(50) NOT NULL,
    comments text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_audit_logs ENABLE ROW LEVEL SECURITY;

-- leave_types: Anyone can read, Admin/Manager can write
CREATE POLICY "Enable read access for all" ON leave_types FOR SELECT USING (true);
CREATE POLICY "Enable ALL for admins" ON leave_types FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- leave_balances: Employees read their own, Admin/Manager reads all and writes
CREATE POLICY "Employees read own balances" ON leave_balances FOR SELECT USING (
    EXISTS (SELECT 1 FROM employees WHERE employees.id = leave_balances.employee_id AND employees.user_id = auth.uid()) OR 
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'manager'))
);
CREATE POLICY "Enable ALL for admins/managers on balances" ON leave_balances FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'manager'))
);

-- holidays: Anyone can read, Admin/Manager can write
CREATE POLICY "Enable read access for all" ON holidays FOR SELECT USING (true);
CREATE POLICY "Enable ALL for admins" ON holidays FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- leave_audit_logs: Employees can read for their leaves, admins read all
CREATE POLICY "Read own logs or all if admin" ON leave_audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE l.id = leave_audit_logs.leave_id AND e.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'manager'))
);
CREATE POLICY "Enable insert for all" ON leave_audit_logs FOR INSERT WITH CHECK (true);

-- Update existing leaves policies (assuming they exist, but ensuring manager access)
-- Actually, the existing `leaves` policy handles employee_id = auth.uid() or role = admin. 
-- We should ensure managers can see their direct reports.
DROP POLICY IF EXISTS "Managers can read direct reports leaves" ON leaves;
CREATE POLICY "Managers can read direct reports leaves" ON leaves FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        JOIN employees m ON e.reporting_manager = m.full_name
        WHERE e.id = leaves.employee_id AND m.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'manager')
    )
);
