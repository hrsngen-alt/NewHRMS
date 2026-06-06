-- SQL Migration to Add Notes Columns to Expense Claims
-- Run this in Supabase → SQL Editor

-- 1. Add employee notes column (employee fills this when submitting)
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Add admin notes column (admin/manager fills when approving/rejecting)
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'expense_claims' 
  AND column_name IN ('notes', 'admin_notes');
