-- ================================================================
-- ADD SALARY AMOUNT COLUMNS TO EMPLOYEES AND PAYSLIPS
-- Run this in your Supabase SQL Editor
-- ================================================================

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS pf_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS esic_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gratuity_amount NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.payslips
ADD COLUMN IF NOT EXISTS gratuity NUMERIC(12,2) DEFAULT 0;
