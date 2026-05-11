-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense_receipts', 'expense_receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for 'expense_receipts'
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;
CREATE POLICY "Anyone can view receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'expense_receipts');

DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'expense_receipts');

DROP POLICY IF EXISTS "Admins can manage receipts" ON storage.objects;
CREATE POLICY "Admins can manage receipts" ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'expense_receipts' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 3. Also fix 'employee_documents' bucket if it exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee_documents', 'employee_documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can manage employee docs" ON storage.objects;
CREATE POLICY "Authenticated users can manage employee docs" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'employee_documents');
