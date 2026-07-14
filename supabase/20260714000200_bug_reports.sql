-- Migration: 20260714000200_bug_reports.sql
-- Description: Creates tables for Bug Reports, Comments, and storage bucket for attachments

-- Create bug_reports table
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT UNIQUE NOT NULL, -- BUG-2026-000123
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  steps_to_reproduce TEXT,
  expected_result TEXT,
  actual_result TEXT,
  sys_url TEXT,
  sys_module TEXT,
  sys_browser TEXT,
  sys_os TEXT,
  sys_ip TEXT,
  sys_device TEXT,
  sys_resolution TEXT,
  sys_timezone TEXT,
  sys_language TEXT,
  sys_app_version TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create bug_comments table
CREATE TABLE IF NOT EXISTS bug_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for bug_reports
-- Users can view their own bugs, admins can view all bugs
CREATE POLICY "Users can view their own bugs" 
  ON bug_reports FOR SELECT 
  TO authenticated 
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    ) 
    OR 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert their own bugs" 
  ON bug_reports FOR INSERT 
  TO authenticated 
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update bugs" 
  ON bug_reports FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create policies for bug_comments
CREATE POLICY "Users can view comments on their bugs" 
  ON bug_comments FOR SELECT 
  TO authenticated 
  USING (
    bug_id IN (
      SELECT id FROM bug_reports WHERE employee_id IN (
        SELECT id FROM employees WHERE user_id = auth.uid()
      )
    )
    OR 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert comments on their bugs" 
  ON bug_comments FOR INSERT 
  TO authenticated 
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Create Storage Bucket for bug attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bug_attachments', 'bug_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for bug_attachments
CREATE POLICY "Public Access" 
  ON storage.objects FOR SELECT 
  TO public 
  USING (bucket_id = 'bug_attachments');

CREATE POLICY "Authenticated users can upload attachments" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK (bucket_id = 'bug_attachments');
