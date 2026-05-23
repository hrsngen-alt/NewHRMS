-- ================================================================
-- ADD BONUS COLUMN TO EMPLOYEES
-- Run this in your Supabase SQL Editor
-- ================================================================

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS bonus NUMERIC(12,2) DEFAULT 0;
