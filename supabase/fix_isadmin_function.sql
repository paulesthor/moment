-- FIX: "isAdmin is not defined" error
-- A RLS policy somewhere references isAdmin() which doesn't exist as a PostgreSQL function.
-- This script creates the missing function(s).

-- Step 1: Find the broken policy (run this first to identify which table)
-- SELECT tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE qual::text ILIKE '%isAdmin%'
--    OR with_check::text ILIKE '%isAdmin%';

-- Step 2: Create the missing functions

-- snake_case version (preferred, used in new policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- camelCase alias to match any policy that calls isAdmin() directly
CREATE OR REPLACE FUNCTION public."isAdmin"()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_admin();
$$;

-- Grant execute to authenticated users (needed for RLS policies)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public."isAdmin"() TO authenticated;
