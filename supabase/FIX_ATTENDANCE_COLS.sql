-- ================================================================
-- ENHANCE ATTENDANCE: GEOLOCATION & FIELD WORK SUPPORT
-- Adds support for tracking locations and metadata.
-- ================================================================

-- 1. Add missing columns to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_lat  NUMERIC;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_lng  NUMERIC;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_lat NUMERIC;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_lng NUMERIC;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS metadata      JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure RLS allows employees to punch in/out
DROP POLICY IF EXISTS "Employees can manage own attendance" ON public.attendance;
CREATE POLICY "Employees can manage own attendance" ON public.attendance FOR ALL TO authenticated 
USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- 3. Fix potential uniqueness constraint if multiple punches per day are allowed
-- Currently it's UNIQUE(employee_id, date). If you want multiple sessions, we'd need to remove this.
-- For now, we'll keep it as one session per day (Check-in / Check-out).
