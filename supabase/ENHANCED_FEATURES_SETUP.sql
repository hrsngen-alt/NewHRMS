-- SQL for Enhanced HR Features

-- 1. Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT DEFAULT 'Pulse HR',
    company_logo_url TEXT,
    pf_rate_employer DECIMAL DEFAULT 12.0,
    pf_rate_employee DECIMAL DEFAULT 12.0,
    esi_rate_employer DECIMAL DEFAULT 3.25,
    esi_rate_employee DECIMAL DEFAULT 0.75,
    pt_threshold DECIMAL DEFAULT 15000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_by UUID REFERENCES auth.users(id)
);

-- 1b. Company Locations Table
CREATE TABLE IF NOT EXISTS company_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    lat DECIMAL NOT NULL,
    lng DECIMAL NOT NULL,
    radius_meters INTEGER DEFAULT 200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Seed initial settings if empty
INSERT INTO company_settings (company_name)
SELECT 'Pulse HR'
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- Seed locations
INSERT INTO company_locations (name, address, lat, lng)
SELECT 'Ahmedabad HQ', 'Kahan Residency, Navrangpura, Ahmedabad', 23.0366, 72.5615
WHERE NOT EXISTS (SELECT 1 FROM company_locations WHERE name = 'Ahmedabad HQ');

INSERT INTO company_locations (name, address, lat, lng)
SELECT 'Surat Branch', 'President Plaza, Nanpura, Surat', 21.1878, 72.8223
WHERE NOT EXISTS (SELECT 1 FROM company_locations WHERE name = 'Surat Branch');

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, success, warning, error
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Performance Reviews Table
CREATE TABLE IF NOT EXISTS performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES auth.users(id),
    review_period TEXT NOT NULL, -- e.g., 'Q1 2024'
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    goals TEXT,
    status TEXT DEFAULT 'draft', -- draft, submitted, discussed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Update Attendance Table (Add location_id)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='location_id') THEN
        ALTER TABLE attendance ADD COLUMN location_id UUID REFERENCES company_locations(id);
    END IF;
END $$;

-- 4. RLS Policies
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage company settings" ON company_settings 
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Users can view their own notifications" ON notifications 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all performance reviews" ON performance_reviews 
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Employees can view their own reviews" ON performance_reviews 
    FOR SELECT USING (EXISTS (SELECT 1 FROM employees WHERE employees.id = employee_id AND employees.user_id = auth.uid()));
