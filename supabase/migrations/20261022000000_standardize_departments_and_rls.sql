-- ==============================================================================
-- Migration: Standardize Department Names and Make Department Manager RLS Safe
-- ==============================================================================

-- 1. Standardize historical employees records
UPDATE public.employees SET department = 'Marketing' WHERE LOWER(TRIM(department)) = 'marketing';
UPDATE public.employees SET department = 'Molecular Biology' WHERE LOWER(TRIM(department)) = 'molecular biology';
UPDATE public.employees SET department = 'Administration' WHERE LOWER(TRIM(department)) = 'administration';
UPDATE public.employees SET department = 'Accounts' WHERE LOWER(TRIM(department)) = 'accounts';
UPDATE public.employees SET department = 'Cytogenetics' WHERE LOWER(TRIM(department)) = 'cytogenetics';
UPDATE public.employees SET department = 'Molecular Biology - Bioinformatics' WHERE LOWER(TRIM(department)) IN ('molecular biology- bioinformatics', 'molecular biology (bioinformatics)');
UPDATE public.employees SET department = 'Cytogenetics - Analysis' WHERE LOWER(TRIM(department)) = 'cytogenetics- analysis';
UPDATE public.employees SET department = 'Cytogenetics - Processing' WHERE LOWER(TRIM(department)) = 'cytogenetics- processing';
UPDATE public.employees SET department = TRIM(department) WHERE department IS NOT NULL;

-- 2. Standardize attendance logs
UPDATE public.attendance SET department = 'Marketing' WHERE LOWER(TRIM(department)) = 'marketing';
UPDATE public.attendance SET department = 'Molecular Biology' WHERE LOWER(TRIM(department)) = 'molecular biology';
UPDATE public.attendance SET department = 'Administration' WHERE LOWER(TRIM(department)) = 'administration';
UPDATE public.attendance SET department = 'Accounts' WHERE LOWER(TRIM(department)) = 'accounts';
UPDATE public.attendance SET department = 'Cytogenetics' WHERE LOWER(TRIM(department)) = 'cytogenetics';
UPDATE public.attendance SET department = 'Molecular Biology - Bioinformatics' WHERE LOWER(TRIM(department)) IN ('molecular biology- bioinformatics', 'molecular biology (bioinformatics)');
UPDATE public.attendance SET department = 'Cytogenetics - Analysis' WHERE LOWER(TRIM(department)) = 'cytogenetics- analysis';
UPDATE public.attendance SET department = 'Cytogenetics - Processing' WHERE LOWER(TRIM(department)) = 'cytogenetics- processing';
UPDATE public.attendance SET department = 'Engineering' WHERE LOWER(TRIM(department)) = 'engineer';
UPDATE public.attendance SET department = 'Supporting Staff' WHERE LOWER(TRIM(department)) = 'staff';
UPDATE public.attendance SET department = TRIM(department) WHERE department IS NOT NULL;

-- 3. Case-insensitive and trimmed department manager check
CREATE OR REPLACE FUNCTION public.is_same_department(_user_id UUID, _target_emp_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.employees u
    JOIN public.employees t ON LOWER(TRIM(u.department)) = LOWER(TRIM(t.department))
    WHERE u.user_id = _user_id 
      AND t.id = _target_emp_id
      AND u.department IS NOT NULL
      AND TRIM(u.department) != ''
  )
$$;
