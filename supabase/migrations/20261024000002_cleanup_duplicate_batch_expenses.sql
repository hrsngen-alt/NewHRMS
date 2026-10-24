-- ==============================================================================
-- Migration: Deduplicate travel_da_batch claims in expense_claims table
-- ==============================================================================

-- Remove historical duplicate travel_da_batch claims created by the client-side
-- refresh loop, keeping only the single latest record for each batch/title.
DELETE FROM public.expense_claims
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY employee_id, title
             ORDER BY created_at DESC, id DESC
           ) as rnum
    FROM public.expense_claims
    WHERE category = 'travel_da_batch'
  ) ranked
  WHERE ranked.rnum > 1
);
