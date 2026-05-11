-- 1. Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT DEFAULT 'public', -- 'public', 'company', 'optional'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'general', 'event', 'policy', 'birthday'
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
    author_id UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Company Documents Table
CREATE TABLE IF NOT EXISTS company_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    category TEXT DEFAULT 'policy', -- 'policy', 'manual', 'form', 'insurance'
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Expense Claims Table
CREATE TABLE IF NOT EXISTS expense_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    title TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category TEXT NOT NULL, -- 'travel', 'food', 'fuel', 'other'
    receipt_url TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view holidays" ON holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage holidays" ON holidays FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view announcements" ON announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage announcements" ON announcements FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view documents" ON company_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage documents" ON company_documents FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Employees can view own expenses" ON expense_claims FOR SELECT TO authenticated USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Employees can create expenses" ON expense_claims FOR INSERT TO authenticated WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage all expenses" ON expense_claims FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
