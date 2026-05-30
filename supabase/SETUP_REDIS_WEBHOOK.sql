-- ====================================================================
-- AUTOMATIC REDIS CACHE INVALIDATION TRIGGERS
-- This script sets up triggers on the 'employees' and 'attendance' tables.
-- Whenever writes occur, PostgreSQL fires HTTP POST webhooks to the respective
-- Edge Functions to purge outdated Redis cache entries.
-- ====================================================================

-- Enable the pg_net extension (Supabase's HTTP networking extension)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Set up common config variables (Replace placeholder service role key)
-- NOTE: For local docker, the URL is http://kong:8000/functions/v1/
-- For remote production, the URL is https://<project-ref>.supabase.co/functions/v1/
DO $$
BEGIN
  -- We initialize database-level configs if needed, or simply construct them in the trigger.
END $$;


-- ====================================================================
-- 1. TRIGGERS FOR EMPLOYEES & SALARY STRUCTURE
-- ====================================================================

-- Create trigger function to invalidate both Employees & Salary Structure lists
CREATE OR REPLACE FUNCTION public.invalidate_employees_and_salary_cache()
RETURNS trigger
SECURITY DEFINER
AS $$
DECLARE
  base_url TEXT := 'https://youbawkwslbaydxbjame.supabase.co/functions/v1/'; -- cloud container endpoint
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI';
BEGIN
  -- A. Invalidate general Employees cache
  PERFORM net.http_post(
    url := base_url || 'employees-cached',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{}'::jsonb
  );

  -- B. Invalidate active Salary Structure cache
  PERFORM net.http_post(
    url := base_url || 'salary-structure-cached',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{}'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to 'employees' table
DROP TRIGGER IF EXISTS tr_invalidate_employees ON public.employees;
CREATE TRIGGER tr_invalidate_employees
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_employees_and_salary_cache();


-- ====================================================================
-- 2. TRIGGERS FOR ATTENDANCE
-- ====================================================================

-- Create trigger function to invalidate role-based Attendance caches
CREATE OR REPLACE FUNCTION public.invalidate_attendance_cache()
RETURNS trigger
SECURITY DEFINER
AS $$
DECLARE
  base_url TEXT := 'https://youbawkwslbaydxbjame.supabase.co/functions/v1/';
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI';
  payload JSONB;
BEGIN
  -- Construct the payload with the modified record's employee_id.
  -- This allows our Edge Function to perform "surgical" cache invalidation
  -- of ONLY the modified employee's cache + the admin overview cache!
  IF (TG_OP = 'DELETE') THEN
    payload := jsonb_build_object('employee_id', OLD.employee_id);
  ELSE
    payload := jsonb_build_object('employee_id', NEW.employee_id);
  END IF;

  PERFORM net.http_post(
    url := base_url || 'attendance-cached',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );

  -- For DELETE events, we return OLD, otherwise NEW
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to 'attendance' table
DROP TRIGGER IF EXISTS tr_invalidate_attendance ON public.attendance;
CREATE TRIGGER tr_invalidate_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_attendance_cache();


-- ====================================================================
-- ALTERNATIVE: DASHBOARD WEBHOOK SETUP (No SQL Triggers Required)
-- ====================================================================
-- If you prefer using the Supabase Dashboard UI instead of running the SQL triggers:
--
-- For Employees:
-- 1. Dashboard -> Database -> Webhooks -> Create Webhook.
-- 2. Table: "employees" | Events: "Insert", "Update", "Delete".
-- 3. Type: "Supabase Edge Function" -> "employees-cached" | Method: "POST".
-- 4. Create another Webhook for Salary Structures:
--    - Table: "employees" | Events: "Insert", "Update", "Delete".
--    - Type: "Supabase Edge Function" -> "salary-structure-cached" | Method: "POST".
--
-- For Attendance:
-- 1. Dashboard -> Database -> Webhooks -> Create Webhook.
-- 2. Table: "attendance" | Events: "Insert", "Update", "Delete".
-- 3. Type: "Supabase Edge Function" -> "attendance-cached" | Method: "POST".
-- ====================================================================
