-- ================================================================
-- SALARY SLIP IMPORT & AUTO GENERATION DATABASE SETUP
-- Run this script in your Supabase SQL Editor
-- ================================================================

-- Add missing columns to public.payslips for Excel import & auto generation
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_pay NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentives NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deductions NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS half_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_marks INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deduction NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_pf NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_esic NUMERIC(12,2) DEFAULT 0;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
SELECT 'SUCCESS! Import & Auto Generation schema is configured.' as status;
