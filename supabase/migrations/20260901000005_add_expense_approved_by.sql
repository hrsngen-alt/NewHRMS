-- Add approved_by column to expense_claims
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS approved_by TEXT;
