-- Add date_of_birth to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Create a helper function to easily get today's birthdays
CREATE OR REPLACE FUNCTION public.get_todays_birthdays()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  photo_url TEXT,
  department TEXT,
  designation TEXT
) 
LANGUAGE sql 
STABLE
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT 
    id, 
    full_name, 
    photo_url, 
    department,
    designation
  FROM public.employees
  WHERE 
    status = 'active'
    AND date_of_birth IS NOT NULL
    AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE);
$$;

-- Grant access so authenticated users can call it
GRANT EXECUTE ON FUNCTION public.get_todays_birthdays() TO authenticated;
